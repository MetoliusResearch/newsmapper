# NewsMapper

A modern web app for mapping news events using GDELT data.

## Features

- **Interactive Map**: Leaflet.js map with ESRI Gray and OpenStreetMap base layers.
- **GDELT Integration**: Overlays news events as GeoJSON points.
- **Filtering**: Filter by resource, region, country, or custom keywords.
- **Time Selection**: View events from the last 24 hours or 7 days.
- **Responsive Design**: Works on desktop and mobile devices.

## Quick Start

### Prerequisites

- Node.js and npm installed.

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/newsmapper.git
   cd newsmapper
   ```
2. Install dependencies:
   ```bash
   npm install
   ```

### Running Locally

Start the development server:

```bash
npm start
```

Open [http://localhost:8080](http://localhost:8080) in your browser.

## Deployment

### GitHub Pages (Automated)

This project is configured to deploy automatically to GitHub Pages using GitHub Actions.

1. Push your changes to the `main` branch.
2. The `.github/workflows/deploy.yml` workflow will build and deploy the site to the `gh-pages` branch.
3. Enable GitHub Pages in your repository settings (Source: `gh-pages` branch).

### Manual Deployment

You can also deploy manually using the `gh-pages` package (if installed):

```bash
npm run deploy
```

## Development

- **Linting**: Run `npx eslint .` to check for code quality issues.
- **Formatting**: Code is formatted using Prettier.

## License

[MIT](LICENSE)
