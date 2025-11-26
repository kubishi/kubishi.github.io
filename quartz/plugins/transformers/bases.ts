import { QuartzTransformerPlugin } from "../types"
import { Root as MdRoot, Code, Html, Text } from "mdast"
import { Root as HtmlRoot, Element } from "hast"
import { visit } from "unist-util-visit"
import yaml from "js-yaml"
import { FilePath, slugifyFilePath } from "../../util/path"
import path from "path"
import { JSResource, CSSResource } from "../../util/resources"
import fs from "fs"
import matter from "gray-matter"
import rehypeRaw from "rehype-raw"
import { fromHtml } from "hast-util-from-html"
// @ts-ignore
import basesScript from "../../components/scripts/bases.inline"
// @ts-ignore
import basesStyle from "../../components/styles/bases.scss"

export interface Options {
  enableBases: boolean
}

const defaultOptions: Options = {
  enableBases: true,
}

interface BaseFilter {
  and?: BaseCondition[]
  or?: BaseCondition[]
}

type BaseCondition = string | BaseFilter

interface BaseSort {
  property: string
  direction: "ASC" | "DESC"
}

interface BaseView {
  type: "table" | "list" | "cards"
  name: string
  filters?: BaseFilter
  order?: string[]
  sort?: BaseSort[]
  columnSize?: Record<string, number>
  rowHeight?: "short" | "medium" | "tall"
  markers?: "number" | "bullet" | "none"
  indentProperties?: boolean
  imageAspectRatio?: number
  image?: string  // Property path for card images (e.g., "note.image")
  separator?: string  // Separator for list view properties (e.g., ". ")
}

interface BaseDefinition {
  filters?: BaseFilter
  formulas?: Record<string, string>
  properties?: Record<string, any>
  views?: BaseView[]
}

interface FileData {
  frontmatter: Record<string, any>
  slug: string
  filePath: string
}

// Cache for loaded .base files and content files
const baseDefinitionCache = new Map<string, BaseDefinition>()
const contentFilesCache = new Map<string, FileData[]>()
let contentDirectory: string | null = null

export const Bases: QuartzTransformerPlugin<Partial<Options>> = (userOpts) => {
  const opts = { ...defaultOptions, ...userOpts }

  // Helper to load all content files from disk
  function loadAllContentFiles(baseDir: string): FileData[] {
    const cacheKey = baseDir
    if (contentFilesCache.has(cacheKey)) {
      return contentFilesCache.get(cacheKey)!
    }

    const files: FileData[] = []

    function walkDir(dir: string) {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true })

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name)

          if (entry.isDirectory()) {
            // Skip hidden directories
            if (!entry.name.startsWith(".")) {
              walkDir(fullPath)
            }
          } else if (entry.isFile() && entry.name.endsWith(".md")) {
            try {
              const content = fs.readFileSync(fullPath, "utf-8")
              const { data: frontmatter } = matter(content)

              // Calculate relative path and slug
              const relativePath = path.relative(baseDir, fullPath)
              const slug = slugifyFilePath(relativePath as FilePath)

              // Extract folder information
              const dirname = path.dirname(relativePath)
              const basename = path.basename(relativePath, ".md")

              files.push({
                frontmatter: {
                  ...frontmatter,
                  // Add file metadata
                  _file: {
                    name: basename,
                    folder: dirname === "." ? "" : dirname,
                    path: relativePath,
                  },
                },
                slug,
                filePath: relativePath,
              })
            } catch (err) {
              console.warn(`Failed to read file ${fullPath}:`, err)
            }
          }
        }
      } catch (err) {
        console.warn(`Failed to read directory ${dir}:`, err)
      }
    }

    walkDir(baseDir)
    contentFilesCache.set(cacheKey, files)
    return files
  }

  // Helper to load a .base file
  function loadBaseDefinition(basePath: string, baseDir: string): BaseDefinition | null {
    const cacheKey = basePath
    if (baseDefinitionCache.has(cacheKey)) {
      return baseDefinitionCache.get(cacheKey)!
    }

    try {
      // Try different possible paths
      const possiblePaths = [
        path.join(baseDir, basePath),
        path.join(baseDir, `${basePath}.base`),
        path.join(baseDir, basePath.replace(/\.base$/, "") + ".base"),
      ]

      for (const fullPath of possiblePaths) {
        if (fs.existsSync(fullPath)) {
          const content = fs.readFileSync(fullPath, "utf-8")
          const baseData = yaml.load(content) as BaseDefinition
          baseDefinitionCache.set(cacheKey, baseData)
          return baseData
        }
      }

      console.warn(`Base file not found: ${basePath}`)
      return null
    } catch (err) {
      console.error(`Failed to load base definition ${basePath}:`, err)
      return null
    }
  }

  // Helper to evaluate filter conditions
  function evaluateCondition(condition: string, file: FileData, baseData: BaseDefinition, allFiles?: FileData[]): boolean {
    try {
      // Handle isEmpty() checks
      if (condition.includes(".isEmpty()")) {
        const negated = condition.startsWith("!")
        const propertyPath = condition.replace(/^!/, "").replace(".isEmpty()", "").trim()
        const value = getPropertyValue(file, propertyPath)
        const isEmpty =
          value === undefined ||
          value === null ||
          value === "" ||
          (Array.isArray(value) && value.length === 0)
        return negated ? !isEmpty : isEmpty
      }

      // Handle equality checks with boolean values (no quotes)
      const boolEqMatch = condition.match(/^(.+?)\s*==\s*(true|false)$/)
      if (boolEqMatch) {
        const [, propertyPath, expectedValue] = boolEqMatch
        let actualValue: any

        // Check if this is a formula
        if (propertyPath.trim().startsWith("formula.")) {
          const formulaName = propertyPath.trim().replace("formula.", "")
          const formula = baseData.formulas?.[formulaName]
          if (formula) {
            actualValue = evaluateExpression(formula, file, baseData, allFiles)
          }
        } else {
          actualValue = getPropertyValue(file, propertyPath.trim())
        }

        const expectedBool = expectedValue === 'true'
        return actualValue === expectedBool
      }

      // Handle equality checks (support both single and double quotes)
      const eqMatch = condition.match(/^(.+?)\s*==\s*["'](.+?)["']$/)
      if (eqMatch) {
        const [, propertyPath, expectedValue] = eqMatch
        let actualValue: any

        // Check if this is a formula
        if (propertyPath.trim().startsWith("formula.")) {
          const formulaName = propertyPath.trim().replace("formula.", "")
          const formula = baseData.formulas?.[formulaName]
          if (formula) {
            actualValue = evaluateFormula(formula, file, baseData, allFiles)
          }
        } else {
          actualValue = getPropertyValue(file, propertyPath.trim())
        }

        return actualValue === expectedValue
      }

      // Handle inequality checks (support both single and double quotes)
      const neqMatch = condition.match(/^(.+?)\s*!=\s*["'](.+?)["']$/)
      if (neqMatch) {
        const [, propertyPath, expectedValue] = neqMatch
        let actualValue: any

        // Check if this is a formula
        if (propertyPath.trim().startsWith("formula.")) {
          const formulaName = propertyPath.trim().replace("formula.", "")
          const formula = baseData.formulas?.[formulaName]
          if (formula) {
            actualValue = evaluateFormula(formula, file, baseData, allFiles)
          }
        } else {
          actualValue = getPropertyValue(file, propertyPath.trim())
        }

        return actualValue !== expectedValue
      }

      // Handle contains checks (for arrays) - support both syntaxes:
      // "property contains 'value'" and "property.contains('value')"
      let containsMatch = condition.match(/^(.+?)\.contains\(["'](.+?)["']\)$/)
      if (!containsMatch) {
        containsMatch = condition.match(/^(.+?)\s+contains\s+["'](.+?)["']$/)
      }
      if (containsMatch) {
        const [, propertyPath, searchValue] = containsMatch
        const actualValue = getPropertyValue(file, propertyPath.trim())
        if (Array.isArray(actualValue)) {
          return actualValue.includes(searchValue)
        }
        return false
      }

      // Check if this is a complex expression (contains method calls or operators)
      if (condition.includes('(') || condition.includes('.map') || condition.includes('.reduce') || condition.includes('.filter')) {
        // Evaluate as a complex expression that should return a boolean
        const result = evaluateExpression(condition, file, baseData, allFiles)
        return Boolean(result)
      }

      // Handle negated boolean properties (e.g., "!in_stock")
      if (condition.startsWith('!')) {
        const propertyPath = condition.slice(1).trim()
        const value = getPropertyValue(file, propertyPath)
        // Negate the boolean value
        return !Boolean(value)
      }

      // Default: try to evaluate as boolean property
      const value = getPropertyValue(file, condition.trim())
      return Boolean(value)
    } catch (err) {
      console.warn(`Failed to evaluate condition: ${condition}`, err)
      return false
    }
  }

  // Helper to get nested property values
  function getPropertyValue(file: FileData, propertyPath: string): any {
    const parts = propertyPath.split(".")
    let current: any = file

    for (const part of parts) {
      if (current === undefined || current === null) {
        return undefined
      }

      // Handle special "file" namespace
      if (part === "file") {
        current = {
          ...(file.frontmatter._file || {
            name: path.basename(file.filePath, ".md"),
            folder: path.dirname(file.filePath),
            path: file.filePath,
            slug: file.slug,
          }),
          // Also include frontmatter properties accessible via file.*
          tags: file.frontmatter.tags,
        }
        continue
      }

      // Handle "note" namespace (same as frontmatter)
      if (part === "note") {
        current = file.frontmatter
        continue
      }

      // Otherwise, check frontmatter
      if (current === file) {
        current = file.frontmatter[part]
      } else {
        current = current[part]
      }
    }

    return current
  }

  // Helper to evaluate filters
  function evaluateFilter(filter: BaseFilter | undefined, file: FileData, baseData: BaseDefinition, allFiles?: FileData[]): boolean {
    if (!filter) return true

    if (filter.and) {
      return filter.and.every((cond) => {
        if (typeof cond === "string") {
          return evaluateCondition(cond, file, baseData, allFiles)
        } else {
          return evaluateFilter(cond, file, baseData, allFiles)
        }
      })
    }

    if (filter.or) {
      return filter.or.some((cond) => {
        if (typeof cond === "string") {
          return evaluateCondition(cond, file, baseData, allFiles)
        } else {
          return evaluateFilter(cond, file, baseData, allFiles)
        }
      })
    }

    return true
  }

  // Helper to parse function arguments (handles nested parentheses and quotes)
  function parseFunctionArgs(argsStr: string): string[] {
    const args: string[] = []
    let current = ""
    let depth = 0
    let inQuotes = false
    let quoteChar = ""

    for (let i = 0; i < argsStr.length; i++) {
      const char = argsStr[i]

      if ((char === '"' || char === "'") && (i === 0 || argsStr[i - 1] !== "\\")) {
        if (!inQuotes) {
          inQuotes = true
          quoteChar = char
        } else if (char === quoteChar) {
          inQuotes = false
        }
        current += char
      } else if (char === "(" && !inQuotes) {
        depth++
        current += char
      } else if (char === ")" && !inQuotes) {
        depth--
        current += char
      } else if (char === "," && depth === 0 && !inQuotes) {
        args.push(current.trim())
        current = ""
      } else {
        current += char
      }
    }

    if (current.trim()) {
      args.push(current.trim())
    }

    return args
  }

  // Helper to evaluate formulas
  function evaluateFormula(formula: string, file: FileData, baseData: BaseDefinition, allFiles?: FileData[]): string {
    try {
      console.log(`[Bases] Evaluating formula for ${file.slug}: ${formula}`)
      // Handle link() function: link(url, text)
      const linkMatch = formula.match(/^link\((.+)\)$/)
      if (linkMatch) {
        const args = parseFunctionArgs(linkMatch[1])
        if (args.length >= 2) {
          // Special case: if first arg is "file.name" or similar file reference,
          // use the file's slug for proper Quartz linking
          let href: string
          const urlArg = args[0].trim()
          if (urlArg === "file.name" || urlArg === "file.path") {
            // Use the slug directly for internal linking
            href = file.slug
          } else if (urlArg.startsWith("file.")) {
            // For other file properties used as links, try to use slug
            href = file.slug
          } else {
            // Otherwise evaluate the expression (might be a URL or other string)
            href = evaluateFormula(args[0], file, baseData, allFiles)
          }

          const text = evaluateFormula(args[1], file, baseData, allFiles)
          if (href && text) {
            // Don't add .html extension - CrawlLinks will handle the transformation
            // Just provide the slug or URL as-is
            return `<a href="${escapeHtml(href)}">${escapeHtml(text)}</a>`
          }
        }
        return ""
      }

      // Handle if() function: if(condition, trueValue, falseValue)
      const ifMatch = formula.match(/^if\((.+)\)$/)
      if (ifMatch) {
        const args = parseFunctionArgs(ifMatch[1])
        if (args.length >= 3) {
          const condValue = evaluateExpression(args[0], file, baseData, allFiles)
          const condition = condValue && condValue !== "" && condValue !== "false"
          if (condition) {
            return evaluateFormula(args[1], file, baseData, allFiles)
          } else {
            return evaluateFormula(args[2], file, baseData, allFiles)
          }
        }
        return ""
      }

      // Handle string concatenation with +
      if (formula.includes("+") && !formula.match(/^"[^"]*"$/)) {
        // Parse + outside of quotes
        const parts: string[] = []
        let current = ""
        let inQuotes = false
        let quoteChar = ""

        for (let i = 0; i < formula.length; i++) {
          const char = formula[i]

          if ((char === '"' || char === "'") && (i === 0 || formula[i - 1] !== "\\")) {
            if (!inQuotes) {
              inQuotes = true
              quoteChar = char
            } else if (char === quoteChar) {
              inQuotes = false
            }
            current += char
          } else if (char === "+" && !inQuotes) {
            parts.push(current.trim())
            current = ""
          } else {
            current += char
          }
        }

        if (current.trim()) {
          parts.push(current.trim())
        }

        return parts.map((p) => evaluateFormula(p, file, baseData, allFiles)).join("")
      }

      // Otherwise, treat as simple expression
      return evaluateExpression(formula, file, baseData, allFiles)
    } catch (err) {
      console.warn(`Failed to evaluate formula: ${formula}`, err)
      return ""
    }
  }

  // Helper to escape HTML
  function escapeHtml(text: string): string {
    const div = { textContent: text } as any
    return (div.textContent as string)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;")
  }

  // Helper to resolve a wikilink to a file slug or regular path
  function resolveWikilink(text: string, allFiles: FileData[]): string | null {
    if (!text) return text

    // Trim whitespace
    text = text.trim()

    // Check if it's a wikilink
    const wikilinkMatch = text.match(/^\[\[([^\]|]+)(?:\|[^\]]+)?\]\]$/)
    if (!wikilinkMatch) {
      // Not a wikilink, but check if it's already an image file
      const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico']
      const hasImageExt = imageExtensions.some(ext => text.toLowerCase().endsWith(ext))
      if (hasImageExt) {
        // Already a plain filename, return as-is
        return text
      }
      return text // Not a wikilink, return as-is
    }

    let pagePath = wikilinkMatch[1]
    
    // Normalize relative paths (remove ../ prefixes)
    pagePath = pagePath.replace(/^(\.\.\/)+/, '')

    // Check if it's an image or static asset (has image extension)
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico']
    const hasImageExt = imageExtensions.some(ext => pagePath.toLowerCase().endsWith(ext))

    if (hasImageExt) {
      // For image assets, return as relative path (Quartz will handle static assets)
      // Remove any leading path separators and use the filename directly
      const filename = pagePath.split('/').pop()
      return filename || pagePath
    }

    // Get just the filename part for matching
    const pageFileName = pagePath.split('/').pop() || pagePath

    // Try to find the file by matching the path (for markdown files)
    const targetFile = allFiles.find(f => {
      const filePath = f.filePath.replace(/\.md$/, '')
      const fileName = f.filePath.split('/').pop()?.replace(/\.md$/, '')

      // Match full path, ending path, or just filename
      return filePath === pagePath ||
             filePath.endsWith('/' + pagePath) ||
             filePath === pagePath.replace(/^\//, '') ||
             fileName === pagePath ||
             fileName === pageFileName
    })

    if (targetFile) {
      // Use the file's slug for proper linking
      return targetFile.slug
    }

    // If not found, return the path without wikilink syntax
    return pagePath
  }

  // Helper to parse wikilinks in text and convert them to HTML links
  function parseWikilinks(text: string, allFiles: FileData[]): string {
    // Match [[Path/To/Page]] or [[Path/To/Page|Alias]]
    const wikilinkRegex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g

    return text.replace(wikilinkRegex, (match, pagePath, alias) => {
      // Normalize relative paths (remove ../ prefixes)
      let normalizedPath = pagePath.replace(/^(\.\.\/)+/, '')
      const displayText = alias || normalizedPath.split('/').pop() || normalizedPath

      // Get just the filename part for matching
      const pageFileName = normalizedPath.split('/').pop() || normalizedPath

      // Try to find the file by matching the path
      const targetFile = allFiles.find(f => {
        const filePath = f.filePath.replace(/\.md$/, '')
        const fileName = f.filePath.split('/').pop()?.replace(/\.md$/, '')
        
        return filePath === normalizedPath || 
               filePath.endsWith('/' + normalizedPath) || 
               filePath === normalizedPath.replace(/^\//, '') ||
               fileName === pageFileName ||
               fileName === normalizedPath
      })

      if (targetFile) {
        // Use the file's slug for proper linking
        return `<a href="${escapeHtml(targetFile.slug)}">${escapeHtml(displayText)}</a>`
      } else {
        // File not found, render as plain text
        return escapeHtml(displayText)
      }
    })
  }

  // Helper to format dates as MM/DD/YYYY
  function formatDate(value: any): string {
    if (!value) return ""

    let date: Date
    if (value instanceof Date) {
      date = value
    } else if (typeof value === 'string') {
      date = new Date(value)
    } else {
      return String(value)
    }

    if (isNaN(date.getTime())) {
      return String(value)
    }

    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const year = date.getFullYear()

    return `${month}/${day}/${year}`
  }

  // Helper to transform Obsidian-style implicit lambdas to JavaScript arrow functions
  function transformObsidianExpression(expr: string): string {
    // Transform .map(expression) to .map(value => expression)
    // This regex captures map calls with implicit lambda syntax
    expr = expr.replace(/\.map\(([^)]+)\)/g, (match, body) => {
      // Check if it already has arrow function syntax
      if (body.includes('=>')) {
        return match
      }
      // Wrap in arrow function with 'value' parameter
      return `.map(value => ${body})`
    })

    // Transform .filter(expression) to .filter(value => expression)
    expr = expr.replace(/\.filter\(([^)]+)\)/g, (match, body) => {
      // Check if it already has arrow function syntax
      if (body.includes('=>')) {
        return match
      }
      // Wrap in arrow function with 'value' parameter
      return `.filter(value => ${body})`
    })

    // Transform .reduce(expression, initial) to .reduce((acc, value) => expression, initial)
    // This is more complex because reduce has two arguments
    expr = expr.replace(/\.reduce\(([^,]+),\s*([^)]+)\)/g, (match, body, initialValue) => {
      // Check if it already has arrow function syntax
      if (body.includes('=>')) {
        return match
      }
      // Wrap in arrow function with 'acc' and 'value' parameters
      return `.reduce((acc, value) => ${body}, ${initialValue})`
    })

    return expr
  }

  // Helper to evaluate expressions with JavaScript-like syntax
  function evaluateExpression(expr: string, file: FileData, _baseData: BaseDefinition, allFiles?: FileData[]): any {
    // Handle string literals
    if (expr.startsWith('"') && expr.endsWith('"')) {
      return expr.slice(1, -1)
    }

    // Handle boolean literals
    if (expr === 'true') return true
    if (expr === 'false') return false

    // Simple property lookup first
    const simpleValue = getPropertyValue(file, expr)

    // If it's a simple property access without method calls, return it
    if (!expr.includes('(') && simpleValue !== undefined) {
      console.log(`[Bases] Expression "${expr}" for ${file.slug} = ${JSON.stringify(simpleValue)}`)
      return simpleValue
    }

    // Transform Obsidian-style implicit lambdas to JavaScript syntax
    const transformedExpr = transformObsidianExpression(expr)

    // For complex expressions with methods, we need JavaScript evaluation
    // Build a safe context with the file's properties and helper functions
    try {
      // Create a helper that resolves file() calls
      const fileHelper = (path: string) => {
        // Find the file that matches this path/wikilink
        if (!allFiles) return { properties: {} }

        // Extract path from wikilink format [[path|alias]]
        const pathMatch = path.match(/\[\[([^\]|]+)/)
        const cleanPath = pathMatch ? pathMatch[1] : path

        // Normalize the path - remove ../ and .md extension
        let normalizedPath = cleanPath.replace(/^(\.\.\/)+/, '').replace(/\.md$/, '')

        // Get just the filename (last part after /)
        const fileName = normalizedPath.split('/').pop() || normalizedPath

        // Try multiple matching strategies
        const targetFile = allFiles.find(f => {
          // Get the file's path without .md extension
          const fPath = f.filePath.replace(/\.md$/, '')
          const fName = fPath.split('/').pop() || ''
          const fSlug = f.slug

          // Strategy 1: Exact filename match
          if (fName === fileName) return true

          // Strategy 2: Full path match
          if (fPath === normalizedPath) return true

          // Strategy 3: Path ends with the normalized path
          if (fPath.endsWith('/' + normalizedPath) || fPath.endsWith(normalizedPath)) return true

          // Strategy 4: Slug match
          if (fSlug === normalizedPath || fSlug.endsWith('/' + normalizedPath)) return true

          return false
        })

        return {
          properties: targetFile?.frontmatter || {}
        }
      }

      const context: any = {
        // Add a fileMetadata object with metadata (renamed to avoid conflict with file() helper)
        fileMetadata: {
          name: file.frontmatter?.name || file.slug,
          slug: file.slug,
          path: file.filePath,
          folder: file.filePath?.split('/').slice(0, -1).join('/') || '',
        },
        // Add all frontmatter properties directly to context
        ...file.frontmatter,
      }

      // Create a Function that evaluates the expression in the context
      // We use Function constructor instead of eval for slightly better safety
      // We pass the file helper as '$file' to avoid naming conflicts
      const contextKeys = Object.keys(context)
      const contextValues = contextKeys.map(k => context[k])

      const fn = new Function('$file', ...contextKeys, `
        "use strict";
        try {
          // Alias $file back to 'file' for use in the expression
          const file = $file;
          return ${transformedExpr};
        } catch (e) {
          console.warn("Expression evaluation error:", e.message);
          return undefined;
        }
      `)

      const result = fn(fileHelper, ...contextValues)
      console.log(`[Bases] Complex expression "${transformedExpr}" for ${file.slug} = ${JSON.stringify(result)}`)
      return result
    } catch (err) {
      console.warn(`[Bases] Failed to evaluate complex expression "${transformedExpr}":`, err)
      return simpleValue !== undefined && simpleValue !== null ? String(simpleValue) : ""
    }
  }

  // Helper to sort files
  function sortFiles(files: FileData[], sortRules: BaseSort[] | undefined): FileData[] {
    if (!sortRules || sortRules.length === 0) return files

    return [...files].sort((a, b) => {
      for (const rule of sortRules) {
        const aVal = getPropertyValue(a, rule.property)
        const bVal = getPropertyValue(b, rule.property)

        let comparison = 0
        if (aVal < bVal) comparison = -1
        else if (aVal > bVal) comparison = 1

        if (rule.direction === "DESC") comparison *= -1

        if (comparison !== 0) return comparison
      }
      return 0
    })
  }

  // Helper to get display name for a property
  function getDisplayName(property: string, baseData: BaseDefinition): string {
    // First, try exact match
    if (baseData.properties?.[property]?.displayName) {
      return baseData.properties[property].displayName
    }

    // Try with "note." prefix if not present
    if (!property.startsWith("note.") && !property.startsWith("file.") && !property.startsWith("formula.")) {
      const withNotePrefix = `note.${property}`
      if (baseData.properties?.[withNotePrefix]?.displayName) {
        return baseData.properties[withNotePrefix].displayName
      }
    }

    // Try without "note." prefix if present
    if (property.startsWith("note.")) {
      const withoutPrefix = property.replace(/^note\./, "")
      if (baseData.properties?.[withoutPrefix]?.displayName) {
        return baseData.properties[withoutPrefix].displayName
      }
    }

    // Default: strip namespace prefixes and return property name
    return property.replace(/^(file|note|formula)\./, "")
  }

  // Helper to render table view
  function renderTableView(view: BaseView, files: FileData[], baseData: BaseDefinition, allFiles: FileData[]): string {
    const headers = view.order || ["file.name"]

    let html = `<div class="base-table-container" data-view-name="${escapeHtml(view.name)}">`
    html += `<table class="base-table">`

    // Render headers
    html += `<thead><tr>`
    for (const header of headers) {
      const displayName = getDisplayName(header, baseData)
      html += `<th>${escapeHtml(displayName)}</th>`
    }
    html += `</tr></thead>`

    // Render rows
    html += `<tbody>`
    for (const file of files) {
      html += `<tr>`
      for (const property of headers) {
        let value: any

        // Check if this is a formula
        if (property.startsWith("formula.")) {
          const formulaName = property.replace("formula.", "")
          const formula = baseData.formulas?.[formulaName]
          if (formula) {
            value = evaluateFormula(formula, file, baseData, allFiles)
          }
        } else {
          value = getPropertyValue(file, property)
        }

        // Format value based on type
        if (value === undefined || value === null) {
          value = ""
        } else if (property.startsWith("formula.")) {
          // Formulas can return HTML (like links) - don't escape or process
        } else if (value instanceof Date || (typeof value === 'string' && !isNaN(Date.parse(value)) && property.toLowerCase().includes('date'))) {
          // Format dates
          value = formatDate(value)
        } else if (Array.isArray(value)) {
          // Join arrays and parse wikilinks
          const joinedValue = value.join(", ")
          value = parseWikilinks(joinedValue, allFiles)
        } else if (typeof value === "string") {
          // Parse wikilinks in string values
          value = parseWikilinks(value, allFiles)
        } else {
          value = escapeHtml(String(value))
        }

        html += `<td>${value}</td>`
      }
      html += `</tr>`
    }
    html += `</tbody>`

    html += `</table>`
    html += `</div>`

    return html
  }

  // Helper to render list view
  function renderListView(view: BaseView, files: FileData[], baseData: BaseDefinition, allFiles: FileData[]): string {
    const properties = view.order || ["file.name"]
    const marker = view.markers || "bullet"
    const listType = marker === "number" ? "ol" : "ul"
    const separator = view.separator

    let html = `<div class="base-list-container" data-view-name="${escapeHtml(view.name)}">`
    html += `<${listType} class="base-list">`

    for (const file of files) {
      html += `<li>`

      // If separator is defined, concatenate all properties with that separator
      if (separator !== undefined) {
        const values: string[] = []

        for (const property of properties) {
          let value: any

          // Check if this is a formula
          if (property.startsWith("formula.")) {
            const formulaName = property.replace("formula.", "")
            const formula = baseData.formulas?.[formulaName]
            if (formula) {
              value = evaluateFormula(formula, file, baseData, allFiles)
            }
          } else {
            value = getPropertyValue(file, property)
          }

          // Format value based on type
          if (value === undefined || value === null) {
            value = ""
          } else if (property.startsWith("formula.")) {
            // Formulas can return HTML - don't escape or process
          } else if (value instanceof Date || (typeof value === 'string' && !isNaN(Date.parse(value)) && property.toLowerCase().includes('date'))) {
            // Format dates
            value = formatDate(value)
          } else if (Array.isArray(value)) {
            // Join arrays and parse wikilinks
            const joinedValue = value.join(", ")
            value = parseWikilinks(joinedValue, allFiles)
          } else if (typeof value === "string") {
            // Parse wikilinks in string values
            value = parseWikilinks(value, allFiles)
          } else {
            value = escapeHtml(String(value))
          }

          // Only add non-empty values
          if (value) {
            values.push(value)
          }
        }

        html += values.join(escapeHtml(separator))
      } else {
        // Original behavior: property labels with values
        for (let i = 0; i < properties.length; i++) {
          const property = properties[i]
          let value: any

          // Check if this is a formula
          if (property.startsWith("formula.")) {
            const formulaName = property.replace("formula.", "")
            const formula = baseData.formulas?.[formulaName]
            if (formula) {
              value = evaluateFormula(formula, file, baseData, allFiles)
            }
          } else {
            value = getPropertyValue(file, property)
          }

          // Format value based on type
          if (value === undefined || value === null) {
            value = ""
          } else if (property.startsWith("formula.")) {
            // Formulas can return HTML - don't escape or process
          } else if (value instanceof Date || (typeof value === 'string' && !isNaN(Date.parse(value)) && property.toLowerCase().includes('date'))) {
            // Format dates
            value = formatDate(value)
          } else if (Array.isArray(value)) {
            // Join arrays and parse wikilinks
            const joinedValue = value.join(", ")
            value = parseWikilinks(joinedValue, allFiles)
          } else if (typeof value === "string") {
            // Parse wikilinks in string values
            value = parseWikilinks(value, allFiles)
          } else {
            value = escapeHtml(String(value))
          }

          // Add separator between properties
          if (i > 0 && view.indentProperties) {
            html += `<br/>&nbsp;&nbsp;`
          } else if (i > 0) {
            html += " - "
          }

          html += value
        }
      }

      html += `</li>`
    }

    html += `</${listType}>`
    html += `</div>`

    return html
  }

  // Helper to render cards view
  function renderCardsView(view: BaseView, files: FileData[], baseData: BaseDefinition, allFiles: FileData[]): string {
    const properties = view.order || ["file.name"]
    const rowHeight = view.rowHeight || "medium"
    const imageProperty = view.image

    let html = `<div class="base-cards-container" data-view-name="${escapeHtml(view.name)}" data-row-height="${rowHeight}">`

    for (const file of files) {
      html += `<div class="base-card">`

      // Render image at the top if specified
      if (imageProperty) {
        const imageValue = getPropertyValue(file, imageProperty)
        if (imageValue) {
          // Resolve wikilinks to actual paths
          const resolvedImageUrl = resolveWikilink(String(imageValue), allFiles) || String(imageValue)
          const aspectRatio = view.imageAspectRatio || 1
          html += `<div class="base-card-image" style="padding-bottom: ${(1 / aspectRatio) * 100}%;">`
          html += `<img src="${escapeHtml(resolvedImageUrl)}" alt="" loading="lazy" />`
          html += `</div>`
        }
      }

      for (const property of properties) {
        let value: any
        let displayName = getDisplayName(property, baseData)

        // Check if this is a formula
        if (property.startsWith("formula.")) {
          const formulaName = property.replace("formula.", "")
          const formula = baseData.formulas?.[formulaName]
          if (formula) {
            value = evaluateFormula(formula, file, baseData, allFiles)
          }
        } else {
          value = getPropertyValue(file, property)
        }

        // Format value based on type
        if (value === undefined || value === null) {
          value = ""
        } else if (property.startsWith("formula.")) {
          // Formulas can return HTML - don't escape or process
        } else if (value instanceof Date || (typeof value === 'string' && !isNaN(Date.parse(value)) && property.toLowerCase().includes('date'))) {
          // Format dates
          value = formatDate(value)
        } else if (Array.isArray(value)) {
          // Join arrays and parse wikilinks
          const joinedValue = value.join(", ")
          value = parseWikilinks(joinedValue, allFiles)
        } else if (typeof value === "string") {
          // Parse wikilinks in string values
          value = parseWikilinks(value, allFiles)
        } else {
          value = escapeHtml(String(value))
        }

        html += `<div class="base-card-property">`
        html += `<span class="base-card-property-name">${escapeHtml(displayName)}:</span> `
        html += `<span class="base-card-property-value">${value}</span>`
        html += `</div>`
      }

      html += `</div>`
    }

    html += `</div>`

    return html
  }

  // Helper to render a view
  function renderView(view: BaseView, allFiles: FileData[], baseData: BaseDefinition): string {
    // Apply base-level filters first
    let files = allFiles.filter((file) => evaluateFilter(baseData.filters, file, baseData, allFiles))

    // Apply view-level filters
    files = files.filter((file) => evaluateFilter(view.filters, file, baseData, allFiles))

    // Sort files
    files = sortFiles(files, view.sort)

    // Render based on view type
    switch (view.type) {
      case "table":
        return renderTableView(view, files, baseData, allFiles)
      case "list":
        return renderListView(view, files, baseData, allFiles)
      case "cards":
        return renderCardsView(view, files, baseData, allFiles)
      default:
        return `<div class="base-error">Unknown view type: ${view.type}</div>`
    }
  }

  // Helper to render all views from a base definition
  function renderBase(baseData: BaseDefinition, allFiles: FileData[], viewName?: string): string {
    if (!baseData.views || baseData.views.length === 0) {
      return `<div class="base-error">No views defined in base</div>`
    }

    // If a specific view is requested, render only that view
    if (viewName) {
      const view = baseData.views.find((v) => v.name === viewName)
      if (!view) {
        return `<div class="base-error">View '${escapeHtml(viewName)}' not found</div>`
      }
      return renderView(view, allFiles, baseData)
    }

    // Otherwise render all views
    let html = `<div class="base-inline">`

    // If multiple views, create tabs
    if (baseData.views.length > 1) {
      html += `<div class="base-view-tabs">`
      baseData.views.forEach((view, i) => {
        html += `<button class="base-view-tab${i === 0 ? " active" : ""}" data-view-index="${i}">${escapeHtml(view.name)}</button>`
      })
      html += `</div>`
    }

    // Render each view
    baseData.views.forEach((view, i) => {
      const display = i === 0 ? "block" : "none"
      html += `<div class="base-view" data-view-index="${i}" style="display: ${display};">`
      html += renderView(view, allFiles, baseData)
      html += `</div>`
    })

    html += `</div>`

    return html
  }

  return {
    name: "Bases",
    textTransform(_ctx, src) {
      // Pre-process .base embeds to prevent OFM from treating them as regular wikilinks
      // We'll use a special marker that we'll convert back in the markdown plugin
      const baseEmbedRegex = /!\[\[([^\]]+\.base)(?:#([^\]]+))?\]\]/g

      // Replace .base embeds with a special marker
      src = src.replace(baseEmbedRegex, (match, basePath, viewName) => {
        // Use a marker that won't be caught by OFM's wikilink regex
        return `{{BASE_EMBED::${basePath}::${viewName || ""}::}}`
      })

      return src
    },
    markdownPlugins(ctx) {
      if (!opts.enableBases) return []

      // Store content directory from context
      if (ctx.argv?.directory) {
        contentDirectory = ctx.argv.directory
      }

      return [
        () => {
          return async (tree: MdRoot, _file) => {
            // Process base embed markers that were created in textTransform
            const embedMarkerRegex = /\{\{BASE_EMBED::([^:]+)::([^:]*)::\}\}/g

            visit(tree, "text", (node: Text, index, parent) => {
              if (!parent || index === undefined) return

              const matches = [...node.value.matchAll(embedMarkerRegex)]
              if (matches.length === 0) return

              const newNodes: any[] = []
              let lastIndex = 0

              for (const match of matches) {
                const [fullMatch, basePath, viewName] = match

                // Add text before the match
                if (match.index! > lastIndex) {
                  newNodes.push({
                    type: "text",
                    value: node.value.slice(lastIndex, match.index),
                  })
                }

                // Create placeholder for base embed
                newNodes.push({
                  type: "html",
                  value: `<div class="base-embed" data-base-path="${escapeHtml(basePath)}" data-view-name="${escapeHtml(viewName || "")}"></div>`,
                })

                lastIndex = match.index! + fullMatch.length
              }

              // Add remaining text
              if (lastIndex < node.value.length) {
                newNodes.push({
                  type: "text",
                  value: node.value.slice(lastIndex),
                })
              }

              parent.children.splice(index, 1, ...newNodes)
            })

            // Process base code blocks: ```base
            visit(tree, "code", (node: Code, index, parent) => {
              if (node.lang !== "base" || !parent || index === undefined) return

              try {
                // Parse the base definition to validate it (will throw if invalid)
                yaml.load(node.value) as BaseDefinition

                // Store the base definition as base64 for processing in HTML plugin
                const base64Data = Buffer.from(node.value).toString("base64")

                // Create placeholder HTML
                let html = `<div class="base-inline-placeholder" data-base-definition="${base64Data}"></div>`

                // Replace code block with HTML placeholder
                parent.children[index] = {
                  type: "html",
                  value: html,
                } as Html
              } catch (err) {
                console.error("Failed to parse base code block:", err)
                parent.children[index] = {
                  type: "html",
                  value: `<div class="base-error">Failed to parse base: ${err}</div>`,
                } as Html
              }
            })
          }
        },
      ]
    },
    htmlPlugins(ctx) {
      if (!opts.enableBases) return []

      return [
        rehypeRaw,
        () => {
          return async (tree: HtmlRoot, _file) => {
            const baseDir = contentDirectory || ctx.argv?.directory || process.cwd()

            // Load all content files
            const allFiles = loadAllContentFiles(baseDir)

            // Process base embed placeholders
            visit(tree, "element", (node: Element, index, parent) => {
              if (
                node.tagName === "div" &&
                node.properties?.className &&
                (node.properties.className as string[]).includes("base-embed")
              ) {
                // HAST normalizes attributes to camelCase, so data-base-path becomes dataBasePath
                const basePath = (node.properties["dataBasePath"] ||
                  node.properties["data-base-path"]) as string
                let viewName = (node.properties["dataViewName"] ||
                  node.properties["data-view-name"]) as string

                // The view name might have been processed by OFM and contain "|alias"
                // Extract just the view name part before the pipe
                if (viewName && viewName.includes("|")) {
                  viewName = viewName.split("|")[1].trim()
                }

                if (basePath) {
                  const baseData = loadBaseDefinition(basePath, baseDir)
                  if (baseData) {
                    const html = renderBase(baseData, allFiles, viewName || undefined)

                    // Parse HTML into HAST nodes and replace
                    if (parent && index !== undefined) {
                      const parsed = fromHtml(html, { fragment: true })
                      parent.children.splice(index, 1, ...parsed.children)
                    }
                  } else {
                    if (parent && index !== undefined) {
                      const errorHtml = `<div class="base-error">Failed to load base: ${escapeHtml(basePath)}</div>`
                      const parsed = fromHtml(errorHtml, { fragment: true })
                      parent.children.splice(index, 1, ...parsed.children)
                    }
                  }
                }
              }

              // Process inline base placeholders
              if (
                node.tagName === "div" &&
                node.properties?.className &&
                (node.properties.className as string[]).includes("base-inline-placeholder")
              ) {
                const base64Data = (node.properties["dataBaseDefinition"] ||
                  node.properties["data-base-definition"]) as string

                if (base64Data) {
                  try {
                    const yamlContent = Buffer.from(base64Data, "base64").toString("utf-8")
                    const baseData = yaml.load(yamlContent) as BaseDefinition

                    const html = renderBase(baseData, allFiles)

                    // Parse HTML into HAST nodes and replace
                    if (parent && index !== undefined) {
                      const parsed = fromHtml(html, { fragment: true })
                      parent.children.splice(index, 1, ...parsed.children)
                    }
                  } catch (err) {
                    console.error("Failed to render inline base:", err)
                    if (parent && index !== undefined) {
                      const errorHtml = `<div class="base-error">Failed to render base: ${err}</div>`
                      const parsed = fromHtml(errorHtml, { fragment: true })
                      parent.children.splice(index, 1, ...parsed.children)
                    }
                  }
                }
              }
            })
          }
        },
      ]
    },
    externalResources() {
      const js: JSResource[] = []
      const css: CSSResource[] = []

      if (opts.enableBases) {
        js.push({
          script: basesScript,
          loadTime: "afterDOMReady",
          contentType: "inline",
        })

        css.push({
          content: basesStyle,
          inline: true,
        })
      }

      return { js, css }
    },
  }
}

declare module "vfile" {
  interface DataMap {
    baseDefinitions?: Record<string, BaseDefinition>
  }
}
