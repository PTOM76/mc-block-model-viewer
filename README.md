# Block Model Viewer [Windows/macOS/Linux]
A tool that can render Minecraft block models and export them as images.

<img width="886" height="593" alt="image" src="https://github.com/user-attachments/assets/5a67cac2-38b7-4907-8d86-9101935b0c50" />


## Gallery
<img width="886" height="593" alt="image" src="https://github.com/user-attachments/assets/4d448c58-6060-4499-a92f-95b557ac3cae" />

<img width="286" height="593" alt="image" src="https://github.com/user-attachments/assets/8ba98106-5b6b-469b-9f6e-9f2bfe3d820d" />

<img width="336" height="293" alt="image" src="https://github.com/user-attachments/assets/0b9b9799-ee64-4919-afb9-56a0f833e579" />

## Building
1. Clone the repository:
```bash
git clone git@github.com:PTOM76/mc-block-model-viewer.git
cd mc-block-model-viewer
```

2. Install dependencies:
```bash
# Using Bun
bun install

# Using npm
npm install
```

3. Run the application for development:
```bash
# Using Bun
bun dev

# Using npm
npm run dev
```

4. Build the application for production:
```bash
# Using Bun
bun run build
bun dist

# Using npm
npm run build
npm run dist
```

## Publishing
```
git tag -a v0.0.0 -m "..."
git push origin v0.0.0
```