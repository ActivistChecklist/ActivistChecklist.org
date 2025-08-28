# ActivistChecklist.org

**Visit the live site: [ActivistChecklist.org](https://activistchecklist.org)**

ActivistChecklist.org is a comprehensive digital security resource designed specifically for activists and organizers. The site provides practical, accessible security guidance that strikes a balance between oversimplified tips and overwhelming technical details. Our mission is to help activists protect their digital lives with clear, actionable checklists and guides that don't require advanced technical expertise. Whether you're new to digital security or looking to strengthen your practices, we offer step-by-step guidance that's both thorough and approachable.

## Install the prerequisites

A Next.js project integrated with Storyblok CMS.

If you're new to node and yarn, follow these steps to install the prerequisites:

```bash
# Install Homebrew first (if you don't have it already)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Node.js and Yarn package manager using Homebrew
brew install node yarn

# Enable Corepack (which enables yarn to install packages globally)
corepack enable 
```

## Setup

1. Clone the repository:

```bash
git clone https://github.com/ActivistChecklist/ActivistChecklist.org.git
cd ActivistChecklist.org
```

2. Install dependencies:

```bash
yarn install
```

3. Copy the `.env.template` file to `.env` and set the Storyblok access token and other environment variables.

4. Start the development server:

```bash
yarn dev
```

The application will be available at `https://localhost:3001`

## Deployment to production server

### Node installation

You'll need to get Node running on your server if you intend to use the contact form, stats tracking, or other server side code.

If you're hosting on May First, follow these instructions to get the [latest verison of Node.js installed](https://help.mayfirst.org/en/guide/how-to-install-node-js-using-nvm).

```bash
cd ~/include/
mkdir .nvm
export NVM_DIR="$HOME/include/.nvm"
# Update this URL to be the latest version of nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# Install the latest version of node (or speicif your version)
nvm install --lts
npm install --global yarn
yarn config set prefix ~/include/.yarn
```

You can run the API server with:

```bash
yarn api:start
```

You can test that it's working locally with:

```bash
curl http://localhost:4321/api-server/hello
```

You'll need to configure your server to proxy API requests to the Node server. If you're using Apache, you can add these lines to your Apache configuration:

```apache
ProxyPass /api-server http://localhost:4321/api-server
ProxyPassReverse /api-server http://localhost:4321/api-server
```

This server side API needs to run in production (in our case, a LAMP server).

Separately, we need to use the built-in Next.js API routes for a staging deployment on a service like Vercel so we can use Storyblok's preview mode to allow for inline editing and previews of draft content.

### Interacting with API server

You can interact with the API server using the following yarn commands:

- `yarn api:start` - Start the API server using PM2 with auto-restart configuration
- `yarn api:stop` - Stop the running API server
- `yarn api:restart` - Restart the API server
- `yarn api:status` - Check the current status of the API server
- `yarn api:delete` - Delete the API server process from PM2
- `yarn api:logs` - View the API server logs

**Auto-Restart Features:**
The API server is configured with PM2's ecosystem config (`ecosystem.config.js`) for robust production deployment:

- Automatically restarts on crashes or unexpected exits
- Uses exponential backoff to prevent restart storms
- Restarts if memory usage exceeds 500MB
- Survives system reboots (after running `pm2 startup` and `pm2 save`)

**First-time Setup for System Reboots:**

```bash
pm2 startup          # Follow the instructions this command provides
yarn api:start       # Start your API server
pm2 save             # Save the current process list
```

The API server runs on port 4321 by default (configurable via `API_PORT` environment variable) and is accessible at `/api-server/*` routes.

### Building, uploading, running

```bash
yarn build && upload  # upload is a custom alias for rsync
```

## Available Scripts

- `yarn dev` - Runs the development server with SSL proxy
- `yarn build` - Builds the application for production
- `yarn start` - Starts the production server
- `yarn serve` - Serves the static production build of the site (from the `out` directory)

## Project Directory Structure

```md
ActivistChecklist.org
├── api - API server (Running on fastify at /api-server/ – Separate from Next.js)
├── components - React components  
├── content - Content backup (YAML/JSON) for version control
├── lib - Core business logic
├── out - Static build of the production site  (run `yarn build` to generate)
├── pages - Next.js pages
│   └── api - API routes specifically for preview mode in Vercel (run via Next.js)
├── public - Public assets (images, fonts, etc.)
│   └── scripts - Public PHP scripts (stats, contact form, etc.)
├── scripts - Build and utility scripts (JS)
├── styles - CSS
└── utils - Utility functions  
```

## Contributing changes to the content

If you'd like to contribute content changes, you can submit a pull request modifying the YAML files in the `/content` directory. While these changes won't be merged directly, we'll review your suggestions and implement approved changes through our content management system.

See [content/README.md](content/README.md) for more information.

## Where does the content live?

All the content is stored in the Storyblok CMS.  You can export the content locally using the export utility:

```bash
# Export both content and images (default)
node scripts/export.js

# Export only content
node scripts/export.js --mode content

# Export only images
node scripts/export.js --mode images

# Show detailed progress
node scripts/export.js --verbose
```

Content will be exported as JSON files maintaining the same structure as in Storyblok. Images will be downloaded to the specified directory, with automatic skipping of previously downloaded files.

## Editing the content in Storyblok

### Rich text inline JSX Compontents

Special parsing available inside rich text fields:

The following text will be parsed as components and rendered as JSX compontents:

```jsx
<Badge variant="destructive">advanced</Badge>
<ProtectionBadge type="baseline" />
<ProtectionBadge type="enhanced" />
```

### Rich text inline CSS classes

The following text will be parsed as a CSS class:

```text
{font-bold text-lg}my fancy text here{/}
```

will be rendered as:

```html
<span class="font-bold text-lg">my fancy text here</span>
```

## License

This repository uses dual licensing:

- All source code is licensed under the [GNU General Public License v3.0](LICENSE-CODE)
- All content, images, and other non-code assets are licensed under the [Creative Commons Attribution-ShareAlike 4.0 International license](https://creativecommons.org/licenses/by-sa/4.0/)
