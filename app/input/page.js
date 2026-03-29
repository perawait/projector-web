"use client";

import { useState } from "react";

export default function InputPage() {
  const [text, setText] = useState("");

  const sendText = async () => {
    if (!text) return;

    await fetch("/api/message", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    });

    setText("");
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen gap-5">
      <h1 className="text-3xl font-bold">พิมพ์ข้อความ</h1>

      <input
        className="border p-3 w-80 rounded"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="พิมพ์ข้อความ"
      />

      <button
        onClick={sendText}
        className="bg-black text-white px-6 py-3 rounded"
      >
        ส่ง
      </button>
    </div>
  );
}