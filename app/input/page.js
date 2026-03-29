"use client";

import { useState } from "react";

const MAX_MESSAGE_LENGTH = 180;

export default function InputPage() {
  const [text, setText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const sendText = async () => {
    const trimmedText = text.trim();

    if (!trimmedText || isSending) return;

    setIsSending(true);
    setFeedback(null);

    try {
      const response = await fetch("/api/message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: trimmedText }),
      });

      const data = await response.json();

      if (!response.ok) {
        setFeedback({ type: "error", text: data.error || "ส่งข้อความไม่สำเร็จ" });
        return;
      }

      setText("");
      setFeedback({ type: "success", text: "ส่งข้อความแล้ว" });
    } catch (error) {
      setFeedback({ type: "error", text: "เกิดข้อผิดพลาดในการเชื่อมต่อ" });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f5ede1] px-4 py-6 sm:px-6 lg:px-8">
      <img
        src="/bg.png"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 h-auto max-w-none -translate-x-1/2 -translate-y-1/2 select-none opacity-90"
      />

      <div className="relative z-10 flex min-h-[calc(100vh-3rem)] items-center justify-center">
        <div className="w-full max-w-3xl">
          <div className="space-y-6 text-center">
            <h1 className="text-xl leading-tight text-white sm:text-2xl lg:text-3xl">
              ในช่วงเวลาที่เหนื่อยที่สุด
              <br />
              คุณอยากให้ใครหรือสิ่งไหนอยู่ข้าง ๆ?
            </h1>

            <input
              id="message"
              type="text"
              maxLength={MAX_MESSAGE_LENGTH}
              className="w-full rounded-xl border border-stone-300 bg-[#fdf9f0] px-4 py-3 text-lg text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-stone-500 focus:ring-2 focus:ring-stone-300"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="พิมพ์คำตอบ . . ."
            />

            {feedback ? (
              <div className="text-center text-sm">
                <span className={feedback.type === "error" ? "text-red-200" : "text-emerald-200"}>
                  {feedback.text}
                </span>
              </div>
            ) : null}

            <div className="flex justify-center">
              <button
                onClick={sendText}
                disabled={isSending || !text.trim()}
                className="inline-flex items-center justify-center rounded-full border-2 border-[#c98531] bg-[#fccd95] px-10 py-3 text-lg font-bold text-white shadow-[0_14px_30px_rgba(129,76,18,0.32)] transition hover:brightness-95 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSending ? "กำลังส่ง..." : "ส่ง"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}