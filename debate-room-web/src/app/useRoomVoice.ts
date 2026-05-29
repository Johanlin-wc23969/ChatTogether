import { useCallback, useEffect, useRef, useState } from "react";
import type { Persona, RoomState } from "../domain/types";
import type { VoiceSignal } from "./useRemoteRoom";

type SendVoiceSignal = (target: string, signalType: VoiceSignal["signalType"], payload?: unknown) => void;
type SetVoiceSignalHandler = (handler: ((signal: VoiceSignal) => void) | null) => void;

export type VoiceStatus = "idle" | "listening" | "connecting" | "connected" | "speaking" | "blocked" | "failed";

const rtcConfig: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export function useRoomVoice(
  room: RoomState | null,
  userId: string | null,
  sendVoiceSignal: SendVoiceSignal,
  setVoiceSignalHandler: SetVoiceSignalHandler,
) {
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>("idle");
  const [voiceError, setVoiceError] = useState("");
  const [voiceEffectLabel, setVoiceEffectLabel] = useState("");
  const roomRef = useRef<RoomState | null>(room);
  const userIdRef = useRef<string | null>(userId);
  const localStreamRef = useRef<MediaStream | null>(null);
  const processedStreamRef = useRef<MediaStream | null>(null);
  const voiceEffectCleanupRef = useRef<(() => void) | null>(null);
  const peersRef = useRef(new Map<string, RTCPeerConnection>());
  const audioRef = useRef(new Map<string, HTMLAudioElement>());
  const localSpeakerActiveRef = useRef(false);

  useEffect(() => {
    roomRef.current = room;
    userIdRef.current = userId;
  }, [room, userId]);
  const hasRoom = Boolean(room);
  const currentSpeakerId = room?.currentSpeakerId ?? null;

  const removePeer = useCallback((remoteUserId: string) => {
    peersRef.current.get(remoteUserId)?.close();
    peersRef.current.delete(remoteUserId);

    const audio = audioRef.current.get(remoteUserId);
    if (audio) {
      audio.pause();
      audio.srcObject = null;
      audio.remove();
      audioRef.current.delete(remoteUserId);
    }
  }, []);

  const stopLocalStream = useCallback(() => {
    processedStreamRef.current?.getTracks().forEach((track) => track.stop());
    processedStreamRef.current = null;
    voiceEffectCleanupRef.current?.();
    voiceEffectCleanupRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    setVoiceEffectLabel("");
  }, []);

  const createPeer = useCallback(
    (remoteUserId: string) => {
      removePeer(remoteUserId);
      const peer = new RTCPeerConnection(rtcConfig);
      peersRef.current.set(remoteUserId, peer);

      peer.onicecandidate = (event) => {
        if (event.candidate) {
          sendVoiceSignal(remoteUserId, "ice", event.candidate.toJSON());
        }
      };

      peer.onconnectionstatechange = () => {
        if (peer.connectionState === "connected") {
          setVoiceError("");
          setVoiceStatus(localSpeakerActiveRef.current ? "speaking" : "connected");
        }
        if (peer.connectionState === "failed" || peer.connectionState === "disconnected") {
          setVoiceStatus("failed");
          setVoiceError("语音连接中断，等待下一位发言或重新申请发言");
        }
      };

      peer.ontrack = (event) => {
        const [stream] = event.streams;
        if (!stream) return;

        let audio = audioRef.current.get(remoteUserId);
        if (!audio) {
          audio = new Audio();
          audio.autoplay = true;
          audio.setAttribute("playsinline", "true");
          audioRef.current.set(remoteUserId, audio);
          document.body.appendChild(audio);
        }
        audio.srcObject = stream;
        void audio.play().catch(() => {
          setVoiceError("浏览器拦截了自动播放，请点击页面后继续收听");
        });
      };

      return peer;
    },
    [removePeer, sendVoiceSignal],
  );

  const stopLocalSpeaker = useCallback(
    (notify = true) => {
      if (notify && localSpeakerActiveRef.current) {
        roomRef.current?.participants
          .filter((participant) => participant.id !== userIdRef.current)
          .forEach((participant) => sendVoiceSignal(participant.id, "stop"));
      }
      localSpeakerActiveRef.current = false;
      stopLocalStream();
      Array.from(peersRef.current.keys()).forEach(removePeer);
    },
    [removePeer, sendVoiceSignal, stopLocalStream],
  );

  const startLocalSpeaker = useCallback(async () => {
    const currentRoom = roomRef.current;
    const currentUserId = userIdRef.current;
    if (!currentRoom || !currentUserId) return;

    setVoiceError("");
    setVoiceStatus("connecting");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      localStreamRef.current = stream;
      localSpeakerActiveRef.current = true;
      const currentParticipant = currentRoom.participants.find((participant) => participant.id === currentUserId);
      const voiceEffect = createVoiceEffectStream(stream, currentParticipant?.persona);
      processedStreamRef.current = voiceEffect.stream;
      voiceEffectCleanupRef.current = voiceEffect.cleanup;
      setVoiceEffectLabel(voiceEffect.label);

      const listeners = currentRoom.participants.filter((participant) => participant.id !== currentUserId);
      await Promise.all(
        listeners.map(async (participant) => {
          const peer = createPeer(participant.id);
          voiceEffect.stream.getTracks().forEach((track) => peer.addTrack(track, voiceEffect.stream));
          const offer = await peer.createOffer();
          await peer.setLocalDescription(offer);
          sendVoiceSignal(participant.id, "offer", offer);
        }),
      );

      setVoiceStatus("speaking");
    } catch {
      stopLocalSpeaker(false);
      setVoiceStatus("blocked");
      setVoiceError("麦克风权限不可用，请在浏览器中允许麦克风访问");
    }
  }, [createPeer, sendVoiceSignal, stopLocalSpeaker]);

  useEffect(() => {
    setVoiceSignalHandler(async (signal) => {
      const currentRoom = roomRef.current;
      const currentUserId = userIdRef.current;
      if (!currentRoom || !currentUserId || signal.from === currentUserId) return;

      if (signal.signalType === "stop") {
        removePeer(signal.from);
        return;
      }

      if (signal.signalType === "offer") {
        if (currentRoom.currentSpeakerId !== signal.from) return;

        setVoiceStatus("connecting");
        const peer = createPeer(signal.from);
        await peer.setRemoteDescription(signal.payload as RTCSessionDescriptionInit);
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        sendVoiceSignal(signal.from, "answer", answer);
        setVoiceError("");
        setVoiceStatus("listening");
        return;
      }

      const peer = peersRef.current.get(signal.from);
      if (!peer) return;

      if (signal.signalType === "answer") {
        await peer.setRemoteDescription(signal.payload as RTCSessionDescriptionInit);
      }
      if (signal.signalType === "ice" && signal.payload) {
        await peer.addIceCandidate(signal.payload as RTCIceCandidateInit);
      }
    });

    return () => setVoiceSignalHandler(null);
  }, [createPeer, removePeer, sendVoiceSignal, setVoiceSignalHandler]);

  useEffect(() => {
    if (!hasRoom || !userId || !currentSpeakerId) {
      stopLocalSpeaker();
      setVoiceStatus("idle");
      return;
    }

    if (currentSpeakerId === userId) {
      void startLocalSpeaker();
      return;
    }

    stopLocalSpeaker();
    Array.from(peersRef.current.keys())
      .filter((remoteUserId) => remoteUserId !== currentSpeakerId)
      .forEach(removePeer);
    setVoiceStatus("listening");
  }, [currentSpeakerId, hasRoom, removePeer, startLocalSpeaker, stopLocalSpeaker, userId]);

  useEffect(() => {
    return () => {
      setVoiceSignalHandler(null);
      stopLocalSpeaker();
    };
  }, [setVoiceSignalHandler, stopLocalSpeaker]);

  return { voiceStatus, voiceError, voiceEffectLabel };
}

interface VoiceEffectResult {
  stream: MediaStream;
  label: string;
  cleanup: () => void;
}

function createVoiceEffectStream(inputStream: MediaStream, persona?: Persona): VoiceEffectResult {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    return { stream: inputStream, label: persona?.voice ?? "原声", cleanup: () => undefined };
  }

  const context = new AudioContextClass();
  void context.resume();
  const source = context.createMediaStreamSource(inputStream);
  const destination = context.createMediaStreamDestination();
  const cleanupCallbacks: Array<() => void> = [];
  const output = buildVoiceChain(context, source, destination, persona?.id, cleanupCallbacks);
  cleanupCallbacks.push(() => void context.close());

  return {
    stream: destination.stream,
    label: output.label,
    cleanup: () => cleanupCallbacks.forEach((cleanup) => {
      try {
        cleanup();
      } catch {
        // Audio nodes can already be stopped when browsers tear down media tracks.
      }
    }),
  };
}

function buildVoiceChain(
  context: AudioContext,
  source: MediaStreamAudioSourceNode,
  destination: MediaStreamAudioDestinationNode,
  personaId: string | undefined,
  cleanupCallbacks: Array<() => void>,
) {
  const inputGain = context.createGain();
  inputGain.gain.value = 0.95;
  source.connect(inputGain);

  const outputGain = context.createGain();
  outputGain.gain.value = 0.92;
  outputGain.connect(destination);

  if (personaId === "bear") {
    const low = context.createBiquadFilter();
    low.type = "lowshelf";
    low.frequency.value = 220;
    low.gain.value = 7;
    const warm = context.createBiquadFilter();
    warm.type = "lowpass";
    warm.frequency.value = 3100;
    inputGain.connect(low).connect(warm).connect(outputGain);
    return { label: "低沉厚重变声" };
  }

  if (personaId === "dog") {
    const bright = context.createBiquadFilter();
    bright.type = "highshelf";
    bright.frequency.value = 1800;
    bright.gain.value = 5;
    const punch = context.createBiquadFilter();
    punch.type = "peaking";
    punch.frequency.value = 900;
    punch.Q.value = 1.1;
    punch.gain.value = 3;
    inputGain.connect(punch).connect(bright).connect(outputGain);
    return { label: "活泼明亮变声" };
  }

  if (personaId === "cat") {
    const light = context.createBiquadFilter();
    light.type = "highpass";
    light.frequency.value = 260;
    const soft = context.createBiquadFilter();
    soft.type = "peaking";
    soft.frequency.value = 2300;
    soft.Q.value = 1.4;
    soft.gain.value = 5;
    inputGain.connect(light).connect(soft).connect(outputGain);
    return { label: "轻柔尖细变声" };
  }

  if (personaId === "bird") {
    const airy = context.createBiquadFilter();
    airy.type = "highpass";
    airy.frequency.value = 420;
    const shine = context.createBiquadFilter();
    shine.type = "highshelf";
    shine.frequency.value = 2600;
    shine.gain.value = 8;
    inputGain.connect(airy).connect(shine).connect(outputGain);
    return { label: "清亮快速变声" };
  }

  if (personaId === "robot") {
    const gain = context.createGain();
    gain.gain.value = 0.8;
    const oscillator = context.createOscillator();
    const modulation = context.createGain();
    oscillator.frequency.value = 42;
    modulation.gain.value = 0.28;
    oscillator.connect(modulation).connect(gain.gain);
    oscillator.start();
    cleanupCallbacks.push(() => oscillator.stop());

    const tone = context.createBiquadFilter();
    tone.type = "bandpass";
    tone.frequency.value = 1050;
    tone.Q.value = 1.8;
    inputGain.connect(tone).connect(gain).connect(outputGain);
    return { label: "电子质感变声" };
  }

  if (personaId === "alien") {
    const delay = context.createDelay(0.08);
    delay.delayTime.value = 0.035;
    const feedback = context.createGain();
    feedback.gain.value = 0.18;
    const wet = context.createGain();
    wet.gain.value = 0.35;
    const dry = context.createGain();
    dry.gain.value = 0.75;
    const shimmer = context.createBiquadFilter();
    shimmer.type = "peaking";
    shimmer.frequency.value = 1550;
    shimmer.Q.value = 1.2;
    shimmer.gain.value = 4;
    delay.connect(feedback).connect(delay);
    inputGain.connect(dry).connect(outputGain);
    inputGain.connect(shimmer).connect(delay).connect(wet).connect(outputGain);
    return { label: "空间变调变声" };
  }

  inputGain.connect(outputGain);
  return { label: personaId ? "匿名变声" : "原声" };
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
