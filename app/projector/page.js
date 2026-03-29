"use client";

import { useEffect, useRef, useState } from "react";

const MAX_MESSAGES = 50;
const FADE_OUT_DURATION = 3000;
const MESSAGE_VISIBLE_TIME = 30 * 60 * 1000;
const VIEWPORT_PADDING = 32;
const HEADER_SAFE_HEIGHT = 220;
const MESSAGE_GAP = 28;
const MAX_POSITION_ATTEMPTS = 80;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function estimateMessageBox(text, viewportWidth) {
  const maxWidth = Math.max(240, Math.min(viewportWidth * 0.52, viewportWidth - VIEWPORT_PADDING * 2));
  const averageCharWidth = clamp(viewportWidth * 0.022, 20, 34);
  const rawWidth = Math.max(220, text.length * averageCharWidth + 48);
  const width = Math.min(rawWidth, maxWidth);
  const lineCount = Math.max(1, Math.ceil(rawWidth / maxWidth));
  const height = 64 + lineCount * 54;

  return { width, height };
}

function getViewportWidth() {
  if (typeof window === "undefined") {
    return 1280;
  }

  return window.innerWidth;
}

function getNormalizedMessageBox(message, viewportWidth = getViewportWidth()) {
  if (message?.box?.width && message?.box?.height) {
    return message.box;
  }

  return estimateMessageBox(message?.text ?? "", viewportWidth);
}

function boxesOverlap(firstBox, secondBox) {
  return !(
    firstBox.left + firstBox.width + MESSAGE_GAP <= secondBox.left ||
    secondBox.left + secondBox.width + MESSAGE_GAP <= firstBox.left ||
    firstBox.top + firstBox.height + MESSAGE_GAP <= secondBox.top ||
    secondBox.top + secondBox.height + MESSAGE_GAP <= firstBox.top
  );
}

function createMessagePlacement(text, existingMessages) {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const box = estimateMessageBox(text, viewportWidth);
  const minLeft = VIEWPORT_PADDING;
  const maxLeft = Math.max(minLeft, viewportWidth - box.width - VIEWPORT_PADDING);
  const minTop = HEADER_SAFE_HEIGHT;
  const maxTop = Math.max(minTop, viewportHeight - box.height - VIEWPORT_PADDING);
  const occupiedBoxes = existingMessages.map((message) => ({
    left: typeof message.position.left === "number" ? message.position.left : VIEWPORT_PADDING,
    top: typeof message.position.top === "number" ? message.position.top : HEADER_SAFE_HEIGHT,
    width: getNormalizedMessageBox(message, viewportWidth).width,
    height: getNormalizedMessageBox(message, viewportWidth).height,
  }));

  for (let index = 0; index < MAX_POSITION_ATTEMPTS; index += 1) {
    const candidate = {
      left: Math.random() * (maxLeft - minLeft || 1) + minLeft,
      top: Math.random() * (maxTop - minTop || 1) + minTop,
      width: box.width,
      height: box.height,
    };

    if (!occupiedBoxes.some((occupiedBox) => boxesOverlap(candidate, occupiedBox))) {
      return {
        position: {
          left: candidate.left,
          top: candidate.top,
        },
        box,
      };
    }
  }

  const columnCount = Math.max(1, Math.floor((viewportWidth - VIEWPORT_PADDING * 2) / (box.width + MESSAGE_GAP)));
  const fallbackIndex = existingMessages.length;
  const column = fallbackIndex % columnCount;
  const row = Math.floor(fallbackIndex / columnCount);

  return {
    position: {
      left: clamp(minLeft + column * (box.width + MESSAGE_GAP), minLeft, maxLeft),
      top: clamp(minTop + row * (box.height + MESSAGE_GAP), minTop, maxTop),
    },
    box,
  };
}

export default function ProjectorPage() {
  const [messages, setMessages] = useState([]);
  const expiringMessageIdsRef = useRef(new Set());
  const displayedMessageIdsRef = useRef(new Set());

  useEffect(() => {
    expiringMessageIdsRef.current.clear();
    displayedMessageIdsRef.current.clear();
  }, []);

  useEffect(() => {
    const updateMessageStatus = async (id, status) => {
      try {
        await fetch("/api/message", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ id, status }),
        });
      } catch (error) {
        console.error("Error updating message status:", error);
      }
    };

    const addIncomingMessages = async (incomingMessages) => {
      const uniqueMessages = incomingMessages.filter((message) => !displayedMessageIdsRef.current.has(message.id));

      if (uniqueMessages.length === 0) {
        return;
      }

      setMessages((currentMessages) => {
        let nextDisplayedMessages = [...currentMessages];

        for (const apiMessage of uniqueMessages.reverse()) {
          const placement = createMessagePlacement(apiMessage.text, nextDisplayedMessages);

          displayedMessageIdsRef.current.add(apiMessage.id);
          nextDisplayedMessages = [
            {
              id: apiMessage.id,
              sourceId: apiMessage.id,
              text: apiMessage.text,
              timestamp: Date.now(),
              position: placement.position,
              box: placement.box,
              motion: {
                x: `${(Math.random() * 20 - 10).toFixed(2)}px`,
                y: `${(Math.random() * 18 - 9).toFixed(2)}px`,
                duration: `${(5.5 + Math.random() * 3).toFixed(2)}s`,
                delay: `${(-Math.random() * 4).toFixed(2)}s`,
              },
              baseOpacity: 0.78 + Math.random() * 0.18,
              isEntering: true,
              isExiting: false,
              exitStartTime: null,
            },
            ...nextDisplayedMessages,
          ].slice(0, MAX_MESSAGES);
        }

        return nextDisplayedMessages;
      });

      await Promise.all(uniqueMessages.map((message) => updateMessageStatus(message.id, "displaying")));
    };

    const eventSource = new EventSource("/api/message/stream?status=sent&limit=10");

    eventSource.addEventListener("snapshot", (event) => {
      const payload = JSON.parse(event.data);
      const nextMessages = Array.isArray(payload.messages) ? payload.messages : [];

      addIncomingMessages(nextMessages).catch((error) => {
        console.error("Error processing snapshot messages:", error);
      });
    });

    eventSource.addEventListener("message", (event) => {
      const payload = JSON.parse(event.data);
      const nextMessage = payload?.message;

      if (!nextMessage || payload.type !== "created") {
        return;
      }

      addIncomingMessages([nextMessage]).catch((error) => {
        console.error("Error processing live message:", error);
      });
    });

    eventSource.onerror = () => {
      console.error("Projector live stream disconnected");
    };

    return () => {
      eventSource.close();
    };
  }, []);

  useEffect(() => {
    const fadeInterval = setInterval(() => {
      const now = Date.now();

      setMessages((currentMessages) =>
        currentMessages
          .map((message) => {
            const age = now - message.timestamp;

            if (age > MESSAGE_VISIBLE_TIME && !message.isExiting) {
              expiringMessageIdsRef.current.add(message.sourceId ?? message.id);

              return {
                ...message,
                isExiting: true,
                exitStartTime: now,
              };
            }

            return message;
          })
          .filter((message) => {
            if (!message.isExiting || !message.exitStartTime) {
              return true;
            }

            if (now - message.exitStartTime >= FADE_OUT_DURATION) {
              displayedMessageIdsRef.current.delete(message.sourceId ?? message.id);
            }

            return now - message.exitStartTime < FADE_OUT_DURATION;
          })
      );
    }, 250);

    return () => clearInterval(fadeInterval);
  }, []);

  useEffect(() => {
    const enteringIds = messages
      .filter((message) => message.isEntering)
      .map((message) => message.id);

    if (enteringIds.length === 0) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setMessages((currentMessages) =>
        currentMessages.map((message) => (
          enteringIds.includes(message.id)
            ? { ...message, isEntering: false }
            : message
        ))
      );
    }, 30);

    return () => window.clearTimeout(timeoutId);
  }, [messages]);

  useEffect(() => {
    const expiringIds = [...expiringMessageIdsRef.current];

    if (expiringIds.length === 0) {
      return;
    }

    expiringMessageIdsRef.current.clear();

    Promise.all(
      expiringIds.map((id) =>
        fetch("/api/message", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ id, status: "expired" }),
        })
      )
    ).catch((error) => {
      console.error("Error expiring messages:", error);
    });
  }, [messages]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-white">
      <div className="pointer-events-none fixed left-1/2 top-8 z-10 w-full max-w-6xl -translate-x-1/2 px-6 text-center text-4xl font-medium leading-snug text-black md:text-6xl lg:text-7xl">
        ในช่วงเวลาที่เหนื่อยที่สุด
        <br />
        คุณอยากให้ใครอยู่ข้าง ๆ?
      </div>

      {messages.map((message) => {
        const fadeAge = message.exitStartTime
          ? Date.now() - message.exitStartTime
          : 0;
        const opacity = message.isExiting
          ? Math.max(0, 1 - fadeAge / FADE_OUT_DURATION)
          : 1;
        const box = getNormalizedMessageBox(message);
        const left = typeof message.position?.left === "number" ? message.position.left : VIEWPORT_PADDING;
        const top = typeof message.position?.top === "number" ? message.position.top : HEADER_SAFE_HEIGHT;
        const motion = message.motion ?? {
          x: "8px",
          y: "-6px",
          duration: "6.5s",
          delay: "0s",
        };
        const baseOpacity = typeof message.baseOpacity === "number" ? message.baseOpacity : 0.88;
        const isEntering = Boolean(message.isEntering);
        const visibleOpacity = message.isExiting ? opacity * baseOpacity : baseOpacity;

        return (
          <div
            key={message.id}
            style={{
              position: "fixed",
              top,
              left,
              maxWidth: box.width,
              opacity: isEntering ? 0 : visibleOpacity,
              transform: isEntering ? "translateY(18px) scale(0.985)" : "translateY(0) scale(1)",
              filter: isEntering ? "blur(3px)" : "blur(0px)",
              transition: "opacity 0.85s ease, transform 0.85s ease, filter 0.85s ease",
              "--float-x": motion.x,
              "--float-y": motion.y,
              "--float-duration": motion.duration,
              "--float-delay": motion.delay,
            }}
            className="pointer-events-none"
          >
            <div className="px-4 py-2 text-6xl leading-tight text-black animate-messageFloat">
              {message.text}
            </div>
          </div>
        );
      })}
    </div>
  );
}