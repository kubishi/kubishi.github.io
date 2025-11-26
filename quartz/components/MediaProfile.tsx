import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"

const MediaProfile: QuartzComponent = ({ fileData, displayClass }: QuartzComponentProps) => {
  // Only render for files in the Media folder
  const slug = fileData.slug || ""
  if (!slug.startsWith("Media/")) {
    return null
  }

  const frontmatter = fileData.frontmatter || {}
  const url = frontmatter.url as string | undefined
  const publisher = frontmatter.publisher as string | undefined
  const date = frontmatter.date as string | undefined
  const authors = frontmatter.authors as string[] | undefined
  const image = frontmatter.image as string | undefined

  // Format date
  const formatDate = (dateStr: string | undefined): string | null => {
    if (!dateStr) return null
    try {
      const d = new Date(dateStr)
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    } catch {
      return dateStr
    }
  }

  const formattedDate = formatDate(date)

  return (
    <div class={classNames(displayClass, "media-profile")}>
      {image && (
        <div class="media-image">
          <img src={image} alt="" loading="lazy" />
        </div>
      )}

      <div class="media-metadata">
        {authors && authors.length > 0 && (
          <div class="media-authors">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            <span>
              {authors.map((author, i) => (
                <span key={i}>
                  {author}
                  {i < authors.length - 1 && ', '}
                </span>
              ))}
            </span>
          </div>
        )}

        {publisher && (
          <div class="media-publisher">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="2" y1="12" x2="22" y2="12"/>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
            <span>{publisher}</span>
          </div>
        )}

        {formattedDate && (
          <div class="media-date">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <span>{formattedDate}</span>
          </div>
        )}

        {url && (
          <div class="media-url">
            <a href={url} target="_blank" rel="noopener noreferrer" class="media-link">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/>
                <line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
              View Article
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

MediaProfile.css = `
.media-profile {
  margin: 2rem 0;
  background: var(--light);
  border: 1px solid var(--lightgray);
  border-radius: 0.5rem;
  overflow: hidden;
}

.media-image {
  width: 100%;
  max-height: 400px;
  overflow: hidden;
  background: var(--lightgray);
}

.media-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  margin: 0;
  border-radius: 0;
}

.media-metadata {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.5rem;
}

.media-authors,
.media-publisher,
.media-date {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--darkgray);
  font-size: 0.95rem;
}

.media-authors svg,
.media-publisher svg,
.media-date svg {
  width: 1.1rem;
  height: 1.1rem;
  flex-shrink: 0;
  color: var(--secondary);
}

.media-url {
  margin-top: 0.5rem;
}

.media-link {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  background: var(--secondary);
  color: var(--light);
  border-radius: 0.5rem;
  text-decoration: none;
  font-weight: 500;
  transition: all 0.2s ease;
}

.media-link:hover {
  background: var(--tertiary);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.media-link svg {
  width: 1.1rem;
  height: 1.1rem;
  flex-shrink: 0;
}

@media (max-width: 768px) {
  .media-image {
    max-height: 250px;
  }

  .media-metadata {
    padding: 1rem;
    gap: 0.75rem;
  }
}
`

export default (() => MediaProfile) satisfies QuartzComponentConstructor
