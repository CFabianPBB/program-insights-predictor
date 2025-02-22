import { Document, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, BorderStyle } from 'docx';
import { saveAs } from 'file-saver';

export const generateWordDocument = (data) => {
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        // Title
        new Paragraph({
          text: `Program Analysis for ${data.organizationName}`,
          heading: HeadingLevel.HEADING_1,
          spacing: {
            after: 400
          }
        }),

        // Building Inspections Section
        new Paragraph({
          text: "Building Inspections",
          heading: HeadingLevel.HEADING_2,
          spacing: {
            before: 400,
            after: 200
          }
        }),

        // Department Info Table
        new Table({
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph("Department:")],
                  width: {
                    size: 2000,
                    type: "dxa"
                  }
                }),
                new TableCell({
                  children: [new Paragraph(data.department)]
                })
              ]
            }),
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph("Total Cost:")],
                }),
                new TableCell({
                  children: [new Paragraph(data.totalCost)]
                })
              ]
            }),
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph("FTE:")],
                }),
                new TableCell({
                  children: [new Paragraph(data.fte.toString())]
                })
              ]
            })
          ]
        })
      ]
    }]
  });

  return doc;
};