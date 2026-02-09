# Development how-to

### Prerequisites

- Get a [Node.js](https://nodejs.org/) (Node 20 LTS recommended)
- Install [pnpm](https://pnpm.io/) (or enable Corepack)

### Development

- It is recommended to create a new Obsidian vault for development
- `git clone` the repo to any place on your filesystem and enter the directory you cloned
- `pnpm install` once to resolve project dependencies
- `pnpm run dev` to mount the plugin to an Obsidian vault and enable hot-reload
  where you would like to test it and get instant feedback on any change in your code

---

Special thanks to:

- [@pjeby][pjeby] for [hot-reload plugin][hot-reload] which gives an instant feedback on code change
- [@zephraph][zephraph] for his [tools for Obsidian plugin development][obsidian-tools] which makes development a breeze

[zephraph]: https://github.com/zephraph/
[obsidian-tools]: https://github.com/zephraph/obsidian-tools
[pjeby]: https://github.com/pjeby
[hot-reload]: https://github.com/pjeby/hot-reload
