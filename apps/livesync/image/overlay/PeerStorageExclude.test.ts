import { PeerStorage } from "./PeerStorage.ts";

Deno.test("storage exclusions apply to relative and mounted paths", async () => {
    const root = await Deno.makeTempDir();
    try {
        const peer = new PeerStorage({
            type: "storage",
            name: "test",
            baseDir: root,
            exclude: [".git/**", ".obsidian/**", "**/*.tmp"],
        }, async () => {});
        const data = { ctime: 1, mtime: 1, size: 1, data: ["x"] };
        if (await peer.put(".git/config", data)) throw new Error("relative .git path was not excluded");
        if (await peer.put(`${root}/.obsidian/app.json`, data)) throw new Error("absolute .obsidian path was not excluded");
        if (await peer.put("draft.tmp", data)) throw new Error("temporary path was not excluded");
    } finally {
        await Deno.remove(root, { recursive: true });
    }
});
