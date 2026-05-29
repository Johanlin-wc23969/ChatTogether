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
  enabled = true,
) {
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>("idle");
  const [voiceError, setVoiceError] = useState("");
  const [voiceEffectLabel, setVoiceEffectLabel] = useState("");
  const [voiceLevel, setVoiceLevel] = useState(0);
  const roomRef = useRef<RoomState | null>(room);
  const userIdRef = useRef<string | null>(userId);
  const localStreamRef = useRef<MediaStream | null>(null);
  const processedStreamRef = useRef<MediaStream | null>(null);
  const voiceEffectCleanupRef = useRef<(() => void) | null>(null);
  const volumeMeterCleanupRef = useRef<(() => void) | null>(null);
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
    volumeMeterCleanupRef.current?.();
    volumeMeterCleanupRef.current = null;
    processedStreamRef.current?.getTracks().forEach((track) => track.stop());
    processedStreamRef.current = null;
    voiceEffectCleanupRef.current?.();
    voiceEffectCleanupRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    setVoiceEffectLabel("");
    setVoiceLevel(0);
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
        volumeMeterCleanupRef.current?.();
        volumeMeterCleanupRef.current = createVolumeMeter(stream, setVoiceLevel);
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
      volumeMeterCleanupRef.current?.();
      volumeMeterCleanupRef.current = createVolumeMeter(stream, setVoiceLevel);
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
    if (!enabled) {
      setVoiceSignalHandler(null);
      return;
    }
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
  }, [createPeer, enabled, removePeer, sendVoiceSignal, setVoiceSignalHandler]);

  useEffect(() => {
    if (!enabled) {
      stopLocalSpeaker();
      setVoiceStatus("idle");
      return;
    }
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
  }, [currentSpeakerId, enabled, hasRoom, removePeer, startLocalSpeaker, stopLocalSpeaker, userId]);

  useEffect(() => {
    return () => {
      setVoiceSignalHandler(null);
      stopLocalSpeaker();
    };
  }, [setVoiceSignalHandler, stopLocalSpeaker]);

  return { voiceStatus, voiceError, voiceEffectLabel, voiceLevel };
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

function createVolumeMeter(stream: MediaStream, onLevel: (level: number) => void) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    return () => undefined;
  }

  const context = new AudioContextClass();
  void context.resume();
  const source = context.createMediaStreamSource(stream);
  const analyser = context.createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0.72;
  source.connect(analyser);

  const samples = new Uint8Array(analyser.fftSize);
  let frame = 0;
  let active = true;

  const tick = () => {
    if (!active) return;
    analyser.getByteTimeDomainData(samples);
    let sum = 0;
    for (const sample of samples) {
      const centered = (sample - 128) / 128;
      sum += centered * centered;
    }
    const rms = Math.sqrt(sum / samples.length);
    const level = Math.min(1, Math.max(0, (rms - 0.015) * 7.2));
    onLevel(level);
    frame = window.requestAnimationFrame(tick);
  };

  tick();
  return () => {
    active = false;
    window.cancelAnimationFrame(frame);
    onLevel(0);
    source.disconnect();
    analyser.disconnect();
    void context.close();
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
    const pitched = context.createGain();
    connectPitchShift(context, inputGain, pitched, 0.72, cleanupCallbacks);
    const low = context.createBiquadFilter();
    low.type = "lowshelf";
    low.frequency.value = 220;
    low.gain.value = 9;
    const warm = context.createBiquadFilter();
    warm.type = "lowpass";
    warm.frequency.value = 2600;
    pitched.connect(low).connect(warm).connect(outputGain);
    return { label: "低沉降调变声" };
  }

  if (personaId === "dog") {
    const pitched = context.createGain();
    connectPitchShift(context, inputGain, pitched, 1.12, cleanupCallbacks);
    const bright = context.createBiquadFilter();
    bright.type = "highshelf";
    bright.frequency.value = 1800;
    bright.gain.value = 5;
    const punch = context.createBiquadFilter();
    punch.type = "peaking";
    punch.frequency.value = 900;
    punch.Q.value = 1.1;
    punch.gain.value = 3;
    pitched.connect(punch).connect(bright).connect(outputGain);
    return { label: "活泼明亮变声" };
  }

  if (personaId === "cat") {
    const pitched = context.createGain();
    connectPitchShift(context, inputGain, pitched, 1.38, cleanupCallbacks);
    const light = context.createBiquadFilter();
    light.type = "highpass";
    light.frequency.value = 320;
    const soft = context.createBiquadFilter();
    soft.type = "peaking";
    soft.frequency.value = 2600;
    soft.Q.value = 1.4;
    soft.gain.value = 6;
    pitched.connect(light).connect(soft).connect(outputGain);
    return { label: "尖细升调变声" };
  }

  if (personaId === "bird") {
    const pitched = context.createGain();
    connectPitchShift(context, inputGain, pitched, 1.55, cleanupCallbacks);
    const airy = context.createBiquadFilter();
    airy.type = "highpass";
    airy.frequency.value = 520;
    const shine = context.createBiquadFilter();
    shine.type = "highshelf";
    shine.frequency.value = 2600;
    shine.gain.value = 8;
    pitched.connect(airy).connect(shine).connect(outputGain);
    return { label: "高频升调变声" };
  }

  if (personaId === "robot") {
    const pitched = context.createGain();
    connectPitchShift(context, inputGain, pitched, 0.9, cleanupCallbacks);
    const gain = context.createGain();
    gain.gain.value = 0.72;
    const oscillator = context.createOscillator();
    const modulation = context.createGain();
    oscillator.frequency.value = 55;
    modulation.gain.value = 0.38;
    oscillator.connect(modulation).connect(gain.gain);
    oscillator.start();
    cleanupCallbacks.push(() => oscillator.stop());

    const tone = context.createBiquadFilter();
    tone.type = "bandpass";
    tone.frequency.value = 1050;
    tone.Q.value = 1.8;
    pitched.connect(tone).connect(gain).connect(outputGain);
    return { label: "机械降调变声" };
  }

  if (personaId === "alien") {
    const pitched = context.createGain();
    connectPitchShift(context, inputGain, pitched, 1.22, cleanupCallbacks);
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
    pitched.connect(dry).connect(outputGain);
    pitched.connect(shimmer).connect(delay).connect(wet).connect(outputGain);
    return { label: "空间升调变声" };
  }

  inputGain.connect(outputGain);
  return { label: personaId ? "匿名变声" : "原声" };
}

function connectPitchShift(
  context: AudioContext,
  input: AudioNode,
  output: AudioNode,
  pitchRatio: number,
  cleanupCallbacks: Array<() => void>,
) {
  if (Math.abs(pitchRatio - 1) < 0.04) {
    input.connect(output);
    return;
  }

  const delayRange = 0.055;
  const slope = Math.abs((1 / pitchRatio) - 1);
  const period = Math.max(0.09, Math.min(0.26, delayRange / Math.max(slope, 0.18)));
  const delayA = context.createDelay(delayRange + 0.02);
  const delayB = context.createDelay(delayRange + 0.02);
  const gainA = context.createGain();
  const gainB = context.createGain();
  const makeup = context.createGain();
  makeup.gain.value = 0.95;

  input.connect(delayA).connect(gainA).connect(makeup).connect(output);
  input.connect(delayB).connect(gainB).connect(makeup);

  const scheduleWindow = (delay: DelayNode, gain: GainNode, startTime: number) => {
    const startDelay = pitchRatio > 1 ? delayRange : 0.002;
    const endDelay = pitchRatio > 1 ? 0.002 : delayRange;
    const attackEnd = startTime + period * 0.2;
    const releaseStart = startTime + period * 0.78;
    const endTime = startTime + period;

    delay.delayTime.cancelScheduledValues(startTime);
    delay.delayTime.setValueAtTime(startDelay, startTime);
    delay.delayTime.linearRampToValueAtTime(endDelay, endTime);

    gain.gain.cancelScheduledValues(startTime);
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(1, attackEnd);
    gain.gain.setValueAtTime(1, releaseStart);
    gain.gain.linearRampToValueAtTime(0, endTime);
  };

  let nextStart = context.currentTime + 0.02;
  const scheduleAhead = () => {
    const horizon = context.currentTime + period * 4;
    while (nextStart < horizon) {
      scheduleWindow(delayA, gainA, nextStart);
      scheduleWindow(delayB, gainB, nextStart + period / 2);
      nextStart += period;
    }
  };

  scheduleAhead();
  const interval = window.setInterval(scheduleAhead, Math.max(30, period * 350));
  cleanupCallbacks.push(() => window.clearInterval(interval));
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
