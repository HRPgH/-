import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "올품(아르바이트) 채용 도우미",
    short_name: "올품 채용 도우미",
    description: "아르바이트 채용 지원, 출근 안내 및 근무 관리",
    lang: "ko",
    start_url: "/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#2563eb",
    icons: [
      {
        src: "/shiftmate-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
