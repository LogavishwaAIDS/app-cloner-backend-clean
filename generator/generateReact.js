import fs from "fs-extra";

export async function generateReactApp(data) {
  const outputDir = `./output/cloned-${Date.now()}`;
  await fs.ensureDir(outputDir);

  const reactFile = `
    import React from "react";

    export default function Home() {
      return (
        <div
          dangerouslySetInnerHTML={{ __html: \`${data.html}\` }}
        />
      );
    }
  `;

  fs.writeFileSync(`${outputDir}/Home.jsx`, reactFile);

  return outputDir;
}
