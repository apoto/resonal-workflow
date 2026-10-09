# resonal-workflow (v1)

[日本語](README.md) | English

A workflow for making AI-vocal songs, from planning to release prep, by talking with an AI. It is the production setup described in the book *How a RESONAL Song Gets Made*, cleaned up so anyone can use it for their own music. The book explains how to use it, step by step, for first-timers.

- Book (Zenn, free, English): https://zenn.dev/apoto/books/resonal-pipeline-en
- Book (Japanese): https://zenn.dev/apoto/books/resonal-pipeline

The agent instructions and skills in this repository are written in Japanese. Claude Code can read them and talk with you in English, but the workflow has only been tested in Japanese.

## Contents

- [The idea](#the-idea)
- [Getting started](#getting-started)
- [What setup asks you](#what-setup-asks-you)
- [How one song is made](#how-one-song-is-made)
- [Music video looks (remaking the template)](#music-video-looks-remaking-the-template)
- [Using it safely](#using-it-safely)
- [Requirements](#requirements)
- [External services and alternatives](#external-services-and-alternatives)
- [Folder layout](#folder-layout)
- [License](#license)
- [Support](#support)
- [Book](#book)

## The idea

The AI does the hands-on work, and people make the decisions. The AI produces the first draft of the plan, lyrics, mastering and music video (MV). From there, people review, choose and give directions to make it better.

This workflow is not meant to replace people. It hands the manual work to the AI so that people can focus on deciding what to make and what is good. Whenever a decision is needed, the AI stops and tells you exactly what it needs from you.

## Getting started

Open [Claude Code](https://docs.anthropic.com/en/docs/claude-code) and ask:

```
https://github.com/apoto/resonal-workflow
I want to make songs with AI using the workflow at this link.
Please bring it onto my computer and start with the setup. Ask me if anything is unclear.
```

If you use another agent such as Codex, it has not been tested. First ask it: "This workflow is written for Claude Code. Please adapt it so it is easy for you to use, then start the setup."

From there, it is a conversation. The AI checks and installs your tools (asking before it installs anything), interviews you, and writes your settings files.

When setup is done, say this to start your first song:

```
I want to make a new song
```

### What to say when you are stuck

| When | Say |
|---|---|
| You want to know how far you've gotten | "How far along are we?" |
| You want to continue from last time | "Continue this song" |
| You want to change settings (character, music style, etc.) | "I want to redo the setup" |
| You want to add your own singing or instruments | "I want to sing the vocals myself" |

## What setup asks you

It asks one question at a time, with examples. If you are not sure, answer "decide later" and move on.

1. The kind of music you want to make (genre, mood, tempo)
2. Theme and world (what you want your songs to express)
3. Singer / character (name, pronoun, personality, look; where the character image is, if you have one) and the image of the singing voice
4. Lyric language and style preferences (optional)
5. Unit name and how credits are written
6. Loudness and tone (`streaming` = typical songs, standard streaming loudness, original tone / `loud` = EDM, rhythm-game style, louder and brighter)
7. External services to use (music, images, video footage, notifications; it suggests recommended ones → [External services and alternatives](#external-services-and-alternatives))
8. Where to release (YouTube / streaming services / other / don't release; you can pick several. For streaming services, it also asks the lyricist and composer credits)

Your answers are written to `profile/` (music style, world, character, lyrics, list of songs) and `workflow.config.json`, and confirmed with you before they are saved. See [`profile.example/`](profile.example/) for an example. If you have a character, the persona section of `CLAUDE.md` is also written so the AI talks in that character's voice.

## How one song is made

When you say "I want to make a new song", `./next.sh` looks at the song folder and returns exactly one next task. The AI does it, checks `./next.sh` again, and repeats.

| # | Step | What the AI does | What you do |
|---|---|---|---|
| 1 | Planning | Proposes 2–3 ideas that don't overlap with recent songs, and writes `BRIEF.md` for the one you pick | **Pick an idea** |
| 2 | Lyrics | Writes a short story first, cuts it down into lyrics, revises from three viewpoints, and writes `LYRICS.md` | — |
| 3 | Composing | Prepares the text to paste into the music generator (Style, Lyrics, Exclude) and a cover image | **Generate in Suno or similar and place the WAV of the take you like** |
| 4 | Mastering | Brings the loudness to target with ffmpeg and reports the numbers with what they mean | — |
| 5 | MV | Makes a lyric MV (16:9 main video, 9:16 short, thumbnail) and fixes it based on your notes (a looping background video is optional) | **Watch it and approve** (ask for fixes as many times as you like) |
| 6 | Release prep | For each release target you chose in setup, prepares the jacket, YouTube description and tags, track info for streaming services, and a checklist (nothing if you chose not to release) | **Upload** |

Everything goes into `songs/<YYMMDD>_<Title>/`. If you stop halfway, `./next.sh --list` shows songs in progress so you can pick up where you left off.

## Music video looks (remaking the template)

By default, `tools/make_mv.sh` makes the MV in one look (`spectrum-still`: a single image shown with camera moves, rainbow light and bouncing lyrics). This look is a **starting point**. You can remake it however you like.

To remake it, tell the AI what you want in words:

```
I want a sense of release at the start of the chorus
Slowly pull the camera back in the verse, and fill the screen with lyrics in the chorus
```

The AI turns what you say into the two things below, writes them into a per-section direction sheet (`DIRECTION.md`), and edits the song's project (made from `templates/mv`). You don't need to learn or pick from these yourself.

- **18 axes**: the list of things an MV decides (it does not mean 18 looks). Lyrics 6 (placement, typeface, entrances and exits, etc.), character 6 (source, motion, framing, etc.), background 4 (source, switching, screen effects, camera) and accents 2. For axes you didn't mention, the AI decides from the song and the images and writes down why.
- **Direction library**: the actual options for each axis. `direction-library/` has 73 techniques and 19 scenes (92 in total). Techniques are grouped into camera, editing, light and color, effects, text, composition, motion and UI. Scenes collect light and technique combinations for places such as underwater or a rainy street. Each entry describes what happens, why it works, numbers, matching emotions and timing, what it pairs well with, and quality checks.

If you want to browse the library yourself, ask "Suggest options from the direction library". When asking for a fix, add "just this song" or "from the next song too", so the AI can choose where to change it (the song's project, or the template / style).

This approach is not limited to MVs. You can reuse it for any video. RESONAL's MVs are one example.

### RESONAL's 13 styles (ready to use)

The looks RESONAL actually uses are shared as 13 styles in `styles/`. Feel free to use them as they are. In the MV step, say the line below, and the AI compares every style against the song's mood (quiet, bright, dark, epic, etc.) and lyrics in a selection table, then suggests candidates. You make the choice.

```
I want to choose the MV look
```

| Style | In a word | Suits |
|---|---|---|
| scatter-mincho | Scattered white Mincho type + digital glitching | Dark, aggressive, restless |
| ring-visualizer (-loop) | Neon circular waveform around a central subject (no lyrics) | Floating, night, instrumentals |
| white-cut | Black Mincho type in the center of white, hard cuts | Quiet, refined, wistful |
| photocopy-zine | Photocopier grain and collage | Bright but with a bite, fast |
| pink-bounce | High-key pink with rounded type and decorations | Bright, cute |
| crimson-gothic | Black and red gothic, Mincho + serif | Dark, alluring, uneasy |
| shape-burst | Letters bounce in one by one with bursts of shapes | Cool, provocative, high energy |
| invert-shapes | White shapes, with only the overlapping text inverted | Dark, aggressive |
| sky-keyvisual | One key visual + motion graphics | Bright, refreshing, fast |
| burn-in | Complementary-color afterimages burned onto black | Wistful, epic |
| lowpoly-corridor | The camera races through a 3D world, the character stands | Epic, dark, solemn |
| plate-swap | Background planes switch on the bar, still character, printed-on text | Night, cool, quiet heat |
| portrait-frame | A still character portrait, switching background videos, stacked vertical text | Quiet, epic, lyrical |

Besides how to decide the 18 axes (`mv-styles`), it includes parts that make a still character bounce on the beat or move at the joints, and a procedure for cutting shots (`mv-styles` / `bounce-rig` / `puppet-rig` / `mv-cut-editing` in `.claude/skills/`).

- The styles are still evolving. Their procedures and structure are not uniform, and they take more effort than the default look. Whether they make a vertical short or thumbnail, and how they read lyrics, differ by style. Each `styles/<name>/README.md` has the steps.
- Character and background images are not included. Try them with your own character images or cover images.

### Adding your own looks / remaking the workflow

When you want more, you can add your own looks in the same format. The steps are in the skills, so you can just ask the AI.

- Add a new style to `styles/` or modify an existing one ("Add / modify a style" in `mv-styles`)
- Add a new technique to the direction library, or correct its numbers with your own measurements (`direction-library/README.md`)

```
Add the current MV to styles/ as a new style
```

It is MIT licensed, so you can also remake the workflow itself into something completely new.

## Using it safely

This workflow runs on your computer. How you use it, the songs you make and the information you enter are never sent to the author (apoto).

It only talks to the outside when you ask a service you chose to do something. Music, image and video generation services receive descriptions of what you want and any reference images. If you use Slack, your finished MV is sent there. Your conversations with the AI (Claude Code, etc.) are handled under each service's terms.

Your Slack token (`.env`) and your setup answers such as names (`profile/`, `workflow.config.json`) are stored locally. They are in `.gitignore` from the start, so they are never pushed to GitHub. When you ask the AI to search the web or use other tools, make sure tokens and personal information don't end up in search queries or external tools. Write tokens directly into `.env` instead of pasting them into the chat.

## Requirements

### Required

- macOS (not tested on Windows)
- Node.js 20 or later
- Python 3.10 or later
- ffmpeg (including ffprobe)
- [openai-whisper](https://github.com/openai/whisper) (used to time the lyrics on screen; on a CPU it can take several times the song's length)
- A music generation service (Suno is recommended; you generate the track yourself)
- Claude Code (works with a Claude account; a browser chat cannot work with files on your computer, so it won't work)
  - Other agents such as Codex may work, but they have not been tested.

### Optional

Choose which to use with `providers` in the next section.

- [codex CLI](https://github.com/openai/codex) (cover image generation; if you don't use it, you get the prompt and prepare the image yourself)
- Kling MCP (to make a looping background video for the MV)
- Slack (to receive the MV and other results in your own channel)

During setup, `tools/check_env.sh` checks what is missing and tells you how to install it.

## External services and alternatives

External services that may cost money are chosen per purpose with `providers` in `workflow.config.json`. The recommendations below are just examples; you can swap them for other services or do it by hand. Setup asks you, and you can change it later by saying something like "I want to use a different image generator".

```json
"providers": {
  "music":  { "use": "suno",  "note": "" },
  "image":  { "use": "codex", "note": "" },
  "video":  { "use": "none",  "note": "" },
  "notify": { "use": "none",  "note": "" }
}
```

| Purpose | Recommended | Values | Used for |
|---|---|---|---|
| `music` | Suno (`suno`) | `suno` / `other` / `manual` | Composing. Whatever you choose, you generate the track and place the WAV |
| `image` | codex CLI (`codex`) | `codex` / `other` / `manual` | Cover image (source of the jacket and thumbnail). Entry point: `tools/gen_image.sh` |
| `video` | Kling MCP (`kling-mcp`) | `kling-mcp` / `other` / `none` | Looping MV background video (optional). With `none`, the background is the still cover |
| `notify` | Slack (`slack`, optional) | `slack` / `none` | Sends the finished MV to your own channel |

- `other`: write how to use it in `note`, and the AI follows it. For example:
  - `"cmd: mytool gen --prompt {prompt} -o {out}"` (images; `{prompt}` `{out}` `{refs}` are replaced and `tools/gen_image.sh` runs it)
  - `"Use the image generation of the xxx MCP"` (the AI uses that MCP)
  - `"Make it in Udio and place the wav"` (music)
- `manual`: you prepare it yourself. The AI hands you the prompt or text and waits.
- `none`: skips that step.
- The AI asks you before generating or sending anything. It does not retry automatically on failure.
- Prices and terms differ by service and can change. Check each service's pricing page and terms before use.
- Settings in the old format (`"tools": { "suno": true, "codex": false, ... }`) are still read as they are (converted to `providers`).

## Folder layout

```
resonal-workflow/
├── CLAUDE.md / AGENTS.md      How the AI behaves (AGENTS.md is a symlink to CLAUDE.md)
├── next.sh                    Returns the current step and the next task
├── workflow.config.example.json → workflow.config.json (created by setup)
├── profile.example/           Example of profile/ (a fictional unit)
├── .claude/skills/            Procedures per step (setup / new-song / planning / lyric-writing /
│                              composing / mastering / music-video / release-prep;
│                              for fancier MVs: mv-styles / bounce-rig / puppet-rig / mv-cut-editing)
├── engine/                    Step checks (Node.js, no dependencies)
├── tools/                     Tool checks, MV creation, image generation entry point, release prep, Slack delivery
├── mastering/                 Automatic mastering (auto_master.py)
├── templates/mv/              MV template (Remotion, the default look)
├── styles/                    13 MV looks (optional; free to add or modify)
├── direction-library/         Direction library (73 techniques + 19 scenes; the AI uses them as options for the axes)
├── songs/                     Song folders (not tracked by git)
└── projects/                  Per-song MV projects (not tracked by git)
```

## License

- The code and documentation in this repository are under the [MIT License](LICENSE).
- The name "RESONAL" and RESONAL's characters are not covered by the license.
- [Remotion](https://www.remotion.dev/), used by the MV template, requires a paid license for some companies depending on their size. Check the [Remotion license](https://www.remotion.dev/license) before use.
- [matchering](https://github.com/sergree/matchering) is GPL-3.0, so it is not bundled. Install it yourself if you want to use it.
- For anything generated with Suno, Kling, codex, etc., follow each service's terms for rights and usage.

## Support

This is v1 as of October 2026, and it will stay as it is. I may fix bugs that make it not work at all.

It is provided as-is. If something doesn't work, is unclear, or you have a request, feel free to reach out on X ([@apopotoapoto](https://x.com/apopotoapoto)). I can't promise to respond to Issues or Pull Requests.

## Book

The book explains how to use this workflow and what each step does.

- [How a RESONAL Song Gets Made — Running a Music Unit with Claude Code (Zenn Book, English)](https://zenn.dev/apoto/books/resonal-pipeline-en)
- [RESONALの1曲ができるまで — Claude Codeで音楽ユニットを回すワークフロー（Zenn Book, Japanese）](https://zenn.dev/apoto/books/resonal-pipeline)

The chapter "RESONAL's Own Setup" also introduces mechanisms RESONAL actually uses that are not in the public version.

---

© 2026 apoto / RESONAL
