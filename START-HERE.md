# Clash n' Clank – Start Here

This kit has everything Claude Code needs to build the first playable version of the game (**Slice 1**). You don't need to write code: you upload files, paste prompts, and try what gets built on your phone.

Your repository: https://github.com/ac8388-fox/clash-n-clank
Your game's web address: https://ac8388-fox.github.io/clash-n-clank/
Screen mockups: https://claude.ai/artifact/2pZWKnuAzJGbU8ieVxSMaS

---

## What's in this kit

| File | What it is |
| --- | --- |
| `START-HERE.md` | This guide |
| `PROMPTS.md` | Six prompts to paste into Claude Code, one per step, each with a phone check |
| `house-*.png` | The art in the **house style**: white, sky blue, and red on black |
| `full-*.png` | The same art in **full color** |

Each picture comes in normal size and `@2x` size. Both art styles are included until you pick one; Claude Code keeps them in separate folders.

**Not in the kit:** the three design docs. Download the **newest** versions from Claude (they changed recently: the one-second hold, colors, lighting). Open each doc in Claude, download it as **Markdown**, and don't rename it:

- `4 Option RPG – Build Spec Slice 1.md`
- `4 Option RPG – Core Rules.md`
- `4 Option RPG – Class Abilities.md`

---

## Step 1 – Upload everything to GitHub

1. In Safari, open your repository.
2. Tap **Add file → Upload files** (on a brand-new empty repository, tap **uploading an existing file**).
3. Select **all 20 pictures**, **PROMPTS.md**, **START-HERE.md**, and the **3 docs**. You can select several at once.
4. Tap **Commit changes**.

If you uploaded older pictures before, uploading these replaces nothing (the names are new), so Claude Code will use these.

## Step 2 – Turn on the web address

**Settings → Pages → Source: Deploy from a branch → main → /(root) → Save.**

## Step 3 – Build with Claude Code

1. Open the **Claude app → Code**.
2. Choose **clash-n-clank**.
3. Paste **Prompt 0** from `PROMPTS.md`.
4. When its answer passes the check, paste **Prompt 1**, and so on through **Prompt 5**, one at a time.

After every step, open the address Claude Code gives you on your phone and do the check under that prompt.

If Claude Code says it opened a **pull request**, open the link, tap **Merge pull request**, then **Confirm**. The site updates in a minute or two.

---

## When something feels wrong

Write what you saw and what you expected, and paste the "If something goes wrong" prompt from `PROMPTS.md`. If you're not sure whether something is right, send a screenshot to the design chat in Claude.

## The finish line

Slice 1 is done when you can play from the title screen to the end on your phone without help, and every box in the **Done checklist** at the end of the Build Spec is ticked.
