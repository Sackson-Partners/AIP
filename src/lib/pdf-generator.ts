import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

interface PDFSection {
  title: string
  content: string
  level?: number // 1, 2, 3 for heading levels
}

interface PDFMetadata {
  title: string
  subtitle?: string
  author?: string
  date?: string
  tags?: string[]
}

export class PDFGenerator {
  private doc: PDFDocument
  private currentPage: any
  private yPosition: number
  private pageWidth: number
  private pageHeight: number
  private margin: number
  private fontSizeTitle = 24
  private fontSizeH1 = 18
  private fontSizeH2 = 14
  private fontSizeBody = 11
  private fontSizeMeta = 9
  private lineHeight = 1.5

  private font: any
  private fontBold: any

  constructor() {
    this.doc = {} as PDFDocument
    this.currentPage = null
    this.yPosition = 0
    this.pageWidth = 595 // A4 width
    this.pageHeight = 842 // A4 height
    this.margin = 50
  }

  async initialize() {
    this.doc = await PDFDocument.create()
    this.font = await this.doc.embedFont(StandardFonts.Helvetica)
    this.fontBold = await this.doc.embedFont(StandardFonts.HelveticaBold)
    this.addPage()
  }

  private addPage() {
    this.currentPage = this.doc.addPage([this.pageWidth, this.pageHeight])
    this.yPosition = this.pageHeight - this.margin
  }

  private checkPageBreak(requiredSpace: number) {
    if (this.yPosition - requiredSpace < this.margin) {
      this.addPage()
    }
  }

  async addMetadata(metadata: PDFMetadata) {
    // Title
    this.checkPageBreak(60)
    this.currentPage.drawText(metadata.title, {
      x: this.margin,
      y: this.yPosition,
      size: this.fontSizeTitle,
      font: this.fontBold,
      color: rgb(0.1, 0.18, 0.29), // brand-navy
    })
    this.yPosition -= this.fontSizeTitle * this.lineHeight + 10

    // Subtitle
    if (metadata.subtitle) {
      this.currentPage.drawText(metadata.subtitle, {
        x: this.margin,
        y: this.yPosition,
        size: this.fontSizeBody,
        font: this.font,
        color: rgb(0.4, 0.4, 0.4),
      })
      this.yPosition -= this.fontSizeBody * this.lineHeight + 5
    }

    // Tags
    if (metadata.tags && metadata.tags.length > 0) {
      const tagsText = metadata.tags.join(' • ')
      this.currentPage.drawText(tagsText, {
        x: this.margin,
        y: this.yPosition,
        size: this.fontSizeMeta,
        font: this.font,
        color: rgb(0.5, 0.5, 0.5),
      })
      this.yPosition -= this.fontSizeMeta * this.lineHeight + 5
    }

    // Date
    if (metadata.date) {
      this.currentPage.drawText(`Date: ${metadata.date}`, {
        x: this.margin,
        y: this.yPosition,
        size: this.fontSizeMeta,
        font: this.font,
        color: rgb(0.6, 0.6, 0.6),
      })
      this.yPosition -= this.fontSizeMeta * this.lineHeight + 20
    }

    // Separator line
    this.currentPage.drawLine({
      start: { x: this.margin, y: this.yPosition },
      end: { x: this.pageWidth - this.margin, y: this.yPosition },
      thickness: 1,
      color: rgb(0.8, 0.8, 0.8),
    })
    this.yPosition -= 20
  }

  async addSection(section: PDFSection) {
    const level = section.level || 1
    let fontSize = this.fontSizeH1
    let font = this.fontBold

    if (level === 2) fontSize = this.fontSizeH2
    if (level === 3) fontSize = this.fontSizeBody

    // Add title
    this.checkPageBreak(fontSize * this.lineHeight + 20)
    this.currentPage.drawText(section.title, {
      x: this.margin,
      y: this.yPosition,
      size: fontSize,
      font,
      color: rgb(0.1, 0.18, 0.29),
    })
    this.yPosition -= fontSize * this.lineHeight + 10

    // Add content
    await this.addParagraph(section.content)
    this.yPosition -= 15 // Space after section
  }

  private async addParagraph(text: string) {
    const maxWidth = this.pageWidth - 2 * this.margin
    const lines = this.wrapText(text, maxWidth, this.fontSizeBody)

    for (const line of lines) {
      this.checkPageBreak(this.fontSizeBody * this.lineHeight)
      this.currentPage.drawText(line, {
        x: this.margin,
        y: this.yPosition,
        size: this.fontSizeBody,
        font: this.font,
        color: rgb(0, 0, 0),
      })
      this.yPosition -= this.fontSizeBody * this.lineHeight
    }
  }

  private wrapText(text: string, maxWidth: number, fontSize: number): string[] {
    const words = text.split(' ')
    const lines: string[] = []
    let currentLine = ''

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word
      const testWidth = this.font.widthOfTextAtSize(testLine, fontSize)

      if (testWidth > maxWidth && currentLine) {
        lines.push(currentLine)
        currentLine = word
      } else {
        currentLine = testLine
      }
    }

    if (currentLine) {
      lines.push(currentLine)
    }

    return lines
  }

  async addTable(headers: string[], rows: string[][]) {
    const colWidth = (this.pageWidth - 2 * this.margin) / headers.length
    const rowHeight = 20

    // Headers
    this.checkPageBreak(rowHeight * (rows.length + 2))

    headers.forEach((header, i) => {
      this.currentPage.drawText(header, {
        x: this.margin + i * colWidth + 5,
        y: this.yPosition,
        size: this.fontSizeBody,
        font: this.fontBold,
        color: rgb(0, 0, 0),
      })
    })
    this.yPosition -= rowHeight

    // Rows
    rows.forEach((row) => {
      this.checkPageBreak(rowHeight)
      row.forEach((cell, i) => {
        this.currentPage.drawText(cell, {
          x: this.margin + i * colWidth + 5,
          y: this.yPosition,
          size: this.fontSizeBody,
          font: this.font,
          color: rgb(0, 0, 0),
        })
      })
      this.yPosition -= rowHeight
    })

    this.yPosition -= 10
  }

  async save(): Promise<Uint8Array> {
    return await this.doc.save()
  }

  async saveAsBase64(): Promise<string> {
    const pdfBytes = await this.save()
    return Buffer.from(pdfBytes).toString('base64')
  }
}

// Helper function to generate PDF from structured data
export async function generateReportPDF(
  metadata: PDFMetadata,
  sections: PDFSection[]
): Promise<Uint8Array> {
  const generator = new PDFGenerator()
  await generator.initialize()
  await generator.addMetadata(metadata)

  for (const section of sections) {
    await generator.addSection(section)
  }

  return await generator.save()
}
