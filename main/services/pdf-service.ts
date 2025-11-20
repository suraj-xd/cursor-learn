import { marked } from 'marked'
import pdfMake from 'pdfmake/build/pdfmake'
import pdfFonts from 'pdfmake/build/vfs_fonts'

if (pdfFonts && typeof pdfFonts === 'object' && 'pdfMake' in pdfFonts) {
  const fonts = pdfFonts as { pdfMake: { vfs: Record<string, string> } }
  pdfMake.vfs = fonts.pdfMake.vfs
}

export async function generatePdf(markdown: string, title: string): Promise<Buffer> {
  const tokens = marked.lexer(markdown)
  const content: Array<Record<string, unknown>> = [
    { text: title, style: 'header' },
    { text: '\n' },
  ]

  tokens.forEach(token => {
    if (token.type === 'heading') {
      content.push({
        text: token.text,
        style: `heading${token.depth}`,
        margin: [0, 10, 0, 5] as [number, number, number, number],
      })
      return
    }

    if (token.type === 'code') {
      const lines = token.text.split('\n')
      const lineHeight = 15
      const padding = 20
      const totalHeight = (lines.length * lineHeight) + (padding * 2)

      content.push({
        stack: [
          {
            canvas: [
              {
                type: 'rect',
                x: 0,
                y: 0,
                w: 515,
                h: totalHeight,
                color: '#1e1e1e',
              },
            ],
          },
          {
            text: token.text,
            style: 'code',
            margin: [10, -totalHeight + padding, 10, padding] as [number, number, number, number],
          },
        ],
        margin: [0, 10, 0, 10] as [number, number, number, number],
      })
      return
    }

    if (token.type === 'list') {
      const items = token.items.map((item: { text: string }) => ({
        text: item.text,
        margin: [0, 2, 0, 2] as [number, number, number, number],
      }))
      content.push({
        ul: items,
        margin: [10, 5, 0, 5] as [number, number, number, number],
      })
      return
    }

    if (token.type === 'paragraph') {
      const parts = token.text.split(/(`[^`]+`|\[TERMINAL OUTPUT NOT INCLUDED\])/).map((part: string) => {
        if (part.startsWith('`') && part.endsWith('`')) {
          return {
            text: part.slice(1, -1),
            style: 'inlineCode',
            background: '#1e1e1e',
            color: '#d4d4d4',
          }
        }
        if (part === '[TERMINAL OUTPUT NOT INCLUDED]') {
          return {
            text: part,
            style: 'placeholder',
            italics: true,
          }
        }
        return part
      })

      content.push({
        text: parts,
        margin: [0, 5, 0, 5] as [number, number, number, number],
      })
      return
    }

    if (token.type === 'hr') {
      content.push({
        canvas: [{ type: 'line', x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 1 }],
        margin: [0, 10, 0, 10] as [number, number, number, number],
      })
    }
  })

  const docDefinition: Record<string, unknown> = {
    content,
    defaultStyle: {
      font: 'Roboto',
    },
    styles: {
      header: {
        fontSize: 24,
        bold: true,
        font: 'Roboto',
        margin: [0, 0, 0, 20] as [number, number, number, number],
      },
      heading1: {
        fontSize: 20,
        bold: true,
        font: 'Roboto',
        color: '#2563eb',
      },
      heading2: {
        fontSize: 18,
        bold: true,
        font: 'Roboto',
        color: '#3b82f6',
      },
      heading3: {
        fontSize: 16,
        bold: true,
        font: 'Roboto',
        color: '#60a5fa',
      },
      code: {
        font: 'Roboto',
        fontSize: 10,
        color: '#d4d4d4',
        lineHeight: 1.5,
        preserveLeadingSpaces: true,
      },
      inlineCode: {
        font: 'Roboto',
        fontSize: 10,
        background: '#1e1e1e',
        color: '#d4d4d4',
        padding: [2, 1, 2, 1] as [number, number, number, number],
      },
      placeholder: {
        color: '#666666',
        fontSize: 12,
      },
    },
    pageMargins: [40, 60, 40, 60] as [number, number, number, number],
  }

  const pdfDoc = pdfMake.createPdf(docDefinition as unknown as Parameters<typeof pdfMake.createPdf>[0])

  return new Promise<Buffer>((resolve, reject) => {
    try {
      pdfDoc.getBuffer((buffer: Buffer) => {
        resolve(buffer)
      })
    } catch (error) {
      reject(error)
    }
  })
}

