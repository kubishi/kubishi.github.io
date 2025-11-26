import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"

const PublicationProfile: QuartzComponent = ({ fileData, displayClass }: QuartzComponentProps) => {
  // Only render for files in the Publications folder
  const slug = fileData.slug || ""
  if (!slug.startsWith("Publications/")) {
    return null
  }

  const frontmatter = fileData.frontmatter || {}
  const venue = frontmatter.venue as string | undefined
  const doi = frontmatter.doi as string | undefined
  const date = frontmatter.date as string | undefined
  const authors = frontmatter.authors as string[] | undefined
  const links = frontmatter.links as string[] | undefined
  const abstract = frontmatter.abstract as string | undefined

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

  // Clean author names by removing wikilink syntax
  const cleanAuthorName = (author: string): string => {
    return author.replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, '$1')
  }

  const formattedDate = formatDate(date)

  return (
    <div class={classNames(displayClass, "publication-profile")}>
      <div class="publication-metadata">
        {authors && authors.length > 0 && (
          <div class="publication-authors">
            {authors.map((author, i) => (
              <span key={i}>
                {cleanAuthorName(author)}
                {i < authors.length - 1 && ', '}
              </span>
            ))}
          </div>
        )}

        {venue && (
          <div class="publication-venue">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            </svg>
            {venue}
          </div>
        )}

        {formattedDate && (
          <div class="publication-date">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            {formattedDate}
          </div>
        )}

        {doi && (
          <div class="publication-doi">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
            </svg>
            <a href={`https://doi.org/${doi}`} target="_blank" rel="noopener noreferrer">
              {doi}
            </a>
          </div>
        )}

        {links && links.length > 0 && (
          <div class="publication-links">
            {links.map((link, i) => (
              <a key={i} href={link} target="_blank" rel="noopener noreferrer" class="publication-link">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/>
                  <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
                PDF
              </a>
            ))}
          </div>
        )}
      </div>

      {abstract && (
        <div class="publication-abstract">
          <h3>Abstract</h3>
          <p>{abstract}</p>
        </div>
      )}
    </div>
  )
}

PublicationProfile.css = `
.publication-profile {
  background: var(--light);
}

.publication-metadata {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.publication-authors {
  font-size: 1.05rem;
  color: var(--dark);
  line-height: 1.6;
}

.publication-venue,
.publication-date,
.publication-doi {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--darkgray);
  font-size: 0.95rem;
}

.publication-venue svg,
.publication-date svg,
.publication-doi svg {
  width: 1.1rem;
  height: 1.1rem;
  flex-shrink: 0;
  color: var(--secondary);
}

.publication-doi a {
  color: var(--secondary);
  text-decoration: none;
}

.publication-doi a:hover {
  color: var(--tertiary);
  text-decoration: underline;
}

.publication-links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 0.5rem;
}

.publication-link {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: var(--highlight);
  border: 1px solid var(--lightgray);
  border-radius: 0.5rem;
  text-decoration: none;
  color: var(--dark);
  font-size: 0.9rem;
  font-weight: 500;
  transition: all 0.2s ease;
}

.publication-link:hover {
  border-color: var(--secondary);
  background: var(--lightgray);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.publication-link svg {
  width: 1rem;
  height: 1rem;
  flex-shrink: 0;
}

.publication-abstract {
  border-top: 1px solid var(--lightgray);
  padding-top: 1.5rem;
}

.publication-abstract h3 {
  margin: 0 0 1rem 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--dark);
}

.publication-abstract p {
  margin: 0;
  line-height: 1.7;
  color: var(--darkgray);
}

@media (max-width: 768px) {
  .publication-profile {
    padding: 1rem;
  }

  .publication-metadata {
    gap: 0.75rem;
  }

  .publication-authors {
    font-size: 1rem;
  }
}
`

export default (() => PublicationProfile) satisfies QuartzComponentConstructor
