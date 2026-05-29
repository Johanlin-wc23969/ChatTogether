import { useEffect, useMemo, useState } from "react";
import {
  addMockParticipant,
  changeCategory,
  changeMaxParticipants,
  createRoom,
  endSpeaking,
  LOCAL_USER_ID,
  requestSideSpeak,
  requestSpeak,
  startRoom,
  tickRoom,
} from "../domain/roomRules";
import type { DebateSide, RoomState, TopicCategory } from "../domain/types";

export function useLocalRoom() {
  const [room, setRoom] = useState<RoomState | null>(null);
  const [draftCategory, setDraftCategory] = useState<TopicCategory>("technology");
  const [draftMaxParticipants, setDraftMaxParticipants] = useState(4);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const handle = window.setInterval(() => {
      const nextNow = Date.now();
      setNow(nextNow);
      setRoom((current) => (current ? tickRoom(current, nextNow) : current));
    }, 250);

    return () => window.clearInterval(handle);
  }, []);

  return useMemo(
    () => ({
      room,
      now,
      draftCategory,
      draftMaxParticipants,
      setCategory: (category: TopicCategory) => {
        setDraftCategory(category);
        setRoom((current) => (current?.status === "waiting" ? changeCategory(current, category) : current));
      },
      setMaxParticipants: (size: number) => {
        setDraftMaxParticipants(size);
        setRoom((current) => (current?.status === "waiting" ? changeMaxParticipants(current, size) : current));
      },
      createNewRoom: () => setRoom(createRoom(draftCategory, draftMaxParticipants)),
      closeRoom: () => setRoom(null),
      addParticipant: () =>
        setRoom((current) => (current ? addMockParticipant(current) : current)),
      start: () => setRoom((current) => (current ? startRoom(current) : current)),
      requestLocalSpeak: () =>
        setRoom((current) => (current ? requestSpeak(current, LOCAL_USER_ID) : current)),
      requestSide: (side: DebateSide) =>
        setRoom((current) => (current ? requestSideSpeak(current, side) : current)),
      endLocalSpeaking: () =>
        setRoom((current) =>
          current?.currentSpeakerId === LOCAL_USER_ID ? endSpeaking(current) : current,
        ),
    }),
    [draftCategory, draftMaxParticipants, now, room],
  );
}
