import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"
import { JSX } from "preact"

const PersonProfile: QuartzComponent = ({ fileData, displayClass }: QuartzComponentProps) => {
  // Only render for files in the People folder
  const slug = fileData.slug || ""
  if (!slug.startsWith("People/")) {
    return null
  }

  const frontmatter = fileData.frontmatter || {}
  const image = frontmatter.image as string | undefined
  const bio = frontmatter.bio as string | undefined
  const email = frontmatter.email as string | undefined
  const links = frontmatter.links as string[] | undefined
  const affiliations = frontmatter.affiliations as string[] | undefined
  const positions = frontmatter.positions as string[] | undefined

  // Helper to extract filename from wikilink
  const resolveImage = (img: string | undefined): string | null => {
    if (!img) return null

    // Check if it's a wikilink like [[image.webp]]
    const wikilinkMatch = img.match(/^\[\[([^\]|]+)(?:\|[^\]]+)?\]\]$/)
    if (wikilinkMatch) {
      const imagePath = wikilinkMatch[1]
      // Extract just the filename
      const filename = imagePath.split('/').pop() || imagePath
      // Images are in the People/images/ directory - use absolute path
      return `/People/images/${filename}`
    }

    // Otherwise assume it's a direct URL or path
    return img
  }

  // Helper to get icon SVG and label for a link
  const getLinkInfo = (url: string): { icon: JSX.Element; label: string } => {
    try {
      const urlObj = new URL(url)
      const domain = urlObj.hostname.replace('www.', '')

      // Map common domains to icons and labels
      if (domain.includes('github.com')) {
        return {
          icon: <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>,
          label: 'GitHub'
        }
      } else if (domain.includes('linkedin.com')) {
        return {
          icon: <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>,
          label: 'LinkedIn'
        }
      } else if (domain.includes('twitter.com') || domain.includes('x.com')) {
        return {
          icon: <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"/></svg>,
          label: 'X'
        }
      } else if (domain.includes('bsky.app') || domain.includes('bluesky')) {
        return {
          icon: <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><path d="M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.815 2.736 3.713 3.66 6.383 3.364.136-.02.275-.039.415-.056-.138.022-.276.04-.415.056-3.912.58-7.387 2.005-2.83 7.078 5.013 5.19 6.87-1.113 7.823-4.308.953 3.195 2.05 9.271 7.733 4.308 4.267-4.308 1.172-6.498-2.74-7.078a8.741 8.741 0 0 1-.415-.056c.14.017.279.036.415.056 2.67.297 5.568-.628 6.383-3.364.246-.828.624-5.79.624-6.478 0-.69-.139-1.861-.902-2.206-.659-.298-1.664-.62-4.3 1.24C16.046 4.748 13.087 8.687 12 10.8Z"/></svg>,
          label: 'Bluesky'
        }
      } else if (domain.includes('scholar.google')) {
        return {
          icon: <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><path d="M5.242 13.769L0 9.5 12 0l12 9.5-5.242 4.269C17.548 11.249 14.978 9.5 12 9.5c-2.977 0-5.548 1.748-6.758 4.269zM12 10a7 7 0 1 0 0 14 7 7 0 0 0 0-14z"/></svg>,
          label: 'Google Scholar'
        }
      } else if (domain.includes('orcid.org')) {
        return {
          icon: <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><path d="M12 0C5.372 0 0 5.372 0 12s5.372 12 12 12 12-5.372 12-12S18.628 0 12 0zM7.369 4.378c.525 0 .947.431.947.947s-.422.947-.947.947a.95.95 0 0 1-.947-.947c0-.525.422-.947.947-.947zm-.722 3.038h1.444v10.041H6.647V7.416zm3.562 0h3.9c3.712 0 5.344 2.653 5.344 5.025 0 2.578-2.016 5.016-5.325 5.016h-3.919V7.416zm1.444 1.303v7.444h2.297c3.272 0 4.022-2.484 4.022-3.722 0-2.016-1.284-3.722-4.097-3.722h-2.222z"/></svg>,
          label: 'ORCID'
        }
      } else {
        return {
          icon: <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/><path d="M2 12h20"/></svg>,
          label: 'Website'
        }
      }
    } catch {
      return {
        icon: <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/><path d="M2 12h20"/></svg>,
        label: 'Link'
      }
    }
  }

  const imageUrl = resolveImage(image)

  return (
    <div class={classNames(displayClass, "person-profile")}>
      <div class="person-profile-header">
        {imageUrl && (
          <div class="person-profile-image">
            <img src={imageUrl} alt="" loading="lazy" />
          </div>
        )}
        <div class="person-profile-info">
          {positions && positions.length > 0 && (
            <div class="person-profile-positions">
              {positions.map((position, i) => (
                <div key={i} class="person-position">{position}</div>
              ))}
            </div>
          )}
          {affiliations && affiliations.length > 0 && (
            <div class="person-profile-affiliations">
              {affiliations.map((affiliation, i) => (
                <div key={i} class="person-affiliation">{affiliation}</div>
              ))}
            </div>
          )}
          {email && (
            <div class="person-profile-email">
              <a href={`mailto:${email}`}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2"/>
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                </svg>
                {email}
              </a>
            </div>
          )}
        </div>
      </div>

      {bio && (
        <div class="person-profile-bio">
          <p>{bio}</p>
        </div>
      )}

      {links && links.length > 0 && (
        <div class="person-profile-links">
          {links.map((link, i) => {
            const info = getLinkInfo(link)
            return (
              <a key={i} href={link} target="_blank" rel="noopener noreferrer" class="person-link">
                <span class="person-link-icon">{info.icon}</span>
                <span class="person-link-label">{info.label}</span>
              </a>
            )
          })}
        </div>
      )}
    </div>
  )
}

PersonProfile.css = `
.person-profile-header {
  display: flex;
  gap: 2rem;
  margin-bottom: 1.5rem;
  align-items: flex-start;
}

.person-profile-image {
  flex-shrink: 0;
  width: 200px;
  height: 200px;
  border-radius: 0.5rem;
  overflow: hidden;
  background: var(--lightgray);
}

.person-profile-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  margin: 0;
  border-radius: 0;
}

.person-profile-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.person-profile-positions {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.person-position {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--dark);
}

.person-profile-affiliations {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.person-affiliation {
  font-size: 1rem;
  color: var(--gray);
}

.person-profile-email {
  margin-top: 0.5rem;
}

.person-profile-email a {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--secondary);
  text-decoration: none;
  font-size: 0.95rem;
}

.person-profile-email a svg {
  width: 1.1rem;
  height: 1.1rem;
  flex-shrink: 0;
}

.person-profile-email a:hover {
  text-decoration: underline;
}

.person-profile-bio {
  margin: 1.5rem 0;
  line-height: 1.7;
  color: var(--darkgray);
}

.person-profile-bio p {
  margin: 0;
}

.person-profile-links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 1.5rem;
}

.person-link {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: var(--bg);
  border: 1px solid var(--lightgray);
  border-radius: 0.5rem;
  text-decoration: none;
  color: var(--dark);
  transition: all 0.2s ease;
}

.person-link:hover {
  border-color: var(--secondary);
  background: var(--lightgray);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.person-link-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.2rem;
  height: 1.2rem;
}

.person-link-icon svg {
  width: 100%;
  height: 100%;
}

.person-link-label {
  font-size: 0.95rem;
  font-weight: 500;
}

@media (max-width: 768px) {
  .person-profile {
    padding: 1.5rem;
  }

  .person-profile-header {
    flex-direction: column;
    gap: 1.5rem;
  }

  .person-profile-image {
    width: 150px;
    height: 150px;
    margin: 0 auto;
  }

  .person-profile-info {
    text-align: center;
  }

  .person-profile-links {
    justify-content: center;
  }
}

@media (prefers-color-scheme: dark) {
  .person-profile {
    background: var(--dark);
    border-color: var(--darkgray);
  }

  .person-link {
    background: var(--darkgray);
    border-color: var(--gray);
  }

  .person-link:hover {
    background: var(--gray);
    border-color: var(--light);
  }
}
`

export default (() => PersonProfile) satisfies QuartzComponentConstructor
