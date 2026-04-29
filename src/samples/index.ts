import manifest from "./manifest.json";
import sampleRoomosMacro from "./sample-roomos-macro.txt?raw";

interface SampleManifestEntry {
  name: string;
  path?: string;
  enabled?: boolean;
}

export interface SampleMacro {
  name: string;
  enabled: boolean;
  content: string;
}

const sampleContentByPath: Record<string, string> = {
  "sample-roomos-macro.txt": sampleRoomosMacro,
};

export const sampleMacros: SampleMacro[] = (manifest as SampleManifestEntry[]).map((sample) => {
  const samplePath = sample.path ?? sample.name;
  const content = sampleContentByPath[samplePath];
  if (content === undefined) {
    throw new Error(`Sample content not found for ${samplePath}.`);
  }

  return {
    name: sample.name,
    enabled: Boolean(sample.enabled),
    content,
  };
});
