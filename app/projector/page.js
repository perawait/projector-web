"use client";

import { useEffect, useState } from "react";

export default function ProjectorPage() {
  const [message, setMessage] = useState("รอข้อความ...");

  useEffect(() => {
    const fetchMessage = async () => {
      const res = await fetch("/api/message");
      const data = await res.json();

      setMessage(data.message || "รอข้อความ...");
    };

    fetchMessage();

    const interval = setInterval(fetchMessage, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center justify-center h-screen bg-black">
      <h1 className="text-white text-8xl text-center px-10">
        {message}
      </h1>
    </div>
  );
}