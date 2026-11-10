import { describe, expect, it } from "vitest";
import {
  parseYoutubeVideoId,
  youtubeEmbedUrl,
  youtubeThumbnailUrl,
} from "@/lib/youtube";

// ชุดเดียวกับเทสต์ฝั่ง gateway (recipe-video-url.dto.spec.ts) — สองฝั่งต้องรับ/ปฏิเสธเหมือนกัน
describe("parseYoutubeVideoId", () => {
  it.each([
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtube.com/watch?v=dQw4w9WgXcQ&t=42s&list=PL123",
    "http://m.youtube.com/watch?feature=share&v=dQw4w9WgXcQ",
    "https://music.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtu.be/dQw4w9WgXcQ?si=abcDEF123",
    "https://www.youtube.com/shorts/dQw4w9WgXcQ",
    "https://www.youtube.com/embed/dQw4w9WgXcQ?start=10",
    "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    "https://www.youtube.com/live/dQw4w9WgXcQ?feature=shared",
    "https://WWW.YouTube.com/watch?v=dQw4w9WgXcQ",
    "  https://youtu.be/dQw4w9WgXcQ  ",
  ])("%s → dQw4w9WgXcQ", (input) => {
    expect(parseYoutubeVideoId(input)).toBe("dQw4w9WgXcQ");
  });

  it.each([
    "",
    "   ",
    null,
    undefined,
    "youtube.com/watch?v=dQw4w9WgXcQ",
    "javascript:alert(1)//youtube.com/watch?v=dQw4w9WgXcQ",
    "ftp://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://vimeo.com/76979871",
    "https://www.youtube.com.evil.example/watch?v=dQw4w9WgXcQ",
    "https://evil.example/?u=https://youtu.be/dQw4w9WgXcQ",
    "https://www.youtube.com/watch?v=short",
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ<x",
    "https://www.youtube.com/@SomeChannel",
    "https://www.youtube.com/playlist?list=PL1234567890",
    "https://youtu.be/",
    "not a link",
  ])("%p → null", (input) => {
    expect(parseYoutubeVideoId(input)).toBeNull();
  });

  it("player กับภาพตัวอย่างใช้รหัสวิดีโอ", () => {
    expect(youtubeEmbedUrl("dQw4w9WgXcQ")).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0",
    );
    expect(youtubeThumbnailUrl("dQw4w9WgXcQ")).toBe(
      "https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg",
    );
  });
});
