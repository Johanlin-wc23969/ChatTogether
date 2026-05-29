import { useCallback, useEffect, useRef, useState } from "react";
import type { RoomState } from "../domain/types";
import type { VoiceSignal } from "./useRemoteRoom";

type SendVoiceSignal = (target: string, signalType: VoiceSignal["signalType"], payload?: unknown) => void;
type SetVoiceSignalHandler = (handler: ((signal: VoiceSignal) => void) | null) => void;

export type VoiceStatus = "idle" | "listening" | "connecting" | "speaking" | "blocked";

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
  const roomRef = useRef<RoomState | null>(room);
  const userIdRef = useRef<string | null>(userId);
  const localStreamRef = useRef<MediaStream | null>(null);
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
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
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

      const listeners = currentRoom.participants.filter((participant) => participant.id !== currentUserId);
      await Promise.all(
        listeners.map(async (participant) => {
          const peer = createPeer(participant.id);
          stream.getTracks().forEach((track) => peer.addTrack(track, stream));
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

  return { voiceStatus, voiceError };
}
