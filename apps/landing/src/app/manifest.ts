import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Gratonite Chat",
    short_name: "Gratonite",
    description:
      "Gratonite Chat is a free, open-source Discord alternative for friend groups and communities.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6efe3",
    theme_color: "#7c3aed",
    icons: [
      {
        src: "/Gratonite_logo.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
