# Numbers Documentation

This directory contains the Jekyll-based documentation site for Numbers.

## Prerequisites

- Ruby 2.7 or higher
- Bundler gem

## Local Development

1. **Install dependencies:**
   ```bash
   cd docs
   bundle install
   ```

2. **Run the development server:**
   ```bash
   bundle exec jekyll serve
   ```

3. **View the site:**
   Open your browser to `http://localhost:4000/docs/`

## Building for Production

```bash
bundle exec jekyll build
```

The static site will be generated in the `_site` directory.

## Deployment Options

### GitHub Pages

1. Push this repository to GitHub
2. Enable GitHub Pages in repository settings
3. Set source to the `docs` folder
4. The site will be available at `https://yourusername.github.io/Numbers/docs/`

### Netlify

1. Connect your repository to Netlify
2. Set build command: `cd docs && bundle exec jekyll build`
3. Set publish directory: `docs/_site`
4. Deploy!

### Custom Server

Build the static site and copy the `_site` directory to your web server.

## Documentation Structure

```
docs/
├── _config.yml              # Jekyll configuration
├── Gemfile                  # Ruby dependencies
├── index.md                 # Home page
├── getting-started.md       # Getting started guide
├── faq.md                   # FAQ
├── _layouts/                # Page templates
│   └── page.html
├── _user_guide/             # User guide pages
│   └── index.md
├── _crypto_operations/      # Crypto operations docs
│   └── index.md
├── _api_reference/          # API documentation
│   └── index.md
└── _tutorials/              # Tutorial pages
```

## Adding New Pages

1. Create a new Markdown file in the appropriate directory
2. Add front matter at the top:
   ```yaml
   ---
   layout: page
   title: Your Page Title
   permalink: /your-url-path/
   ---
   ```
3. Write your content in Markdown
4. The page will be automatically generated

## Writing Documentation

### Headers

Use Markdown headers (#, ##, ###) for structure.

### Code Blocks

```language
code here
```

### Links

- Internal: `[Link Text](/path/to/page/)`
- External: `[Link Text](https://example.com)`

### Images

Place images in `assets/images/` and reference:
```markdown
![Alt text](/assets/images/image.png)
```

## Need Help?

- [Jekyll Documentation](https://jekyllrb.com/docs/)
- [Markdown Guide](https://www.markdownguide.org/)
- Contact the Numbers team

---

**Happy documenting!** 📚
