"use client";

import React, { useState } from 'react';
import ExcelJS from 'exceljs';
import { Document, Paragraph, Packer, HeadingLevel, TextRun } from 'docx';
import { saveAs } from 'file-saver';

export default function Home() {
  const [organizationName, setOrganizationName] = useState('');
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const generatePrompt = (program) => {
    return `As a government program analyst, analyze the following program and provide practical cost-saving and revenue-generating solutions that have been implemented in other jurisdictions in the US:

PROGRAM DETAILS
Organization: ${organizationName}
Department: ${program.department}
Program: ${program.programName}
Description: ${program.description || 'Not provided'}
Total Cost: $${program.totalCost?.toLocaleString() || 'Not provided'}
FTE: ${program.fte || 'Not provided'}

Based on real examples from other jurisdictions, provide:

COST-SAVING SOLUTIONS
Identify 3 specific examples referencing the names of other cities/counties who have reduced costs and saved money in similar programs:

1. Organization: [Name a specific city/county that implemented this solution]
Description: Describe their specific implementation, including processes changed, technology used, or staff reallocation. Include measurable outcomes they achieved.
Potential Savings: Estimate potential savings for ${organizationName} based on their results.

2. Organization: [Name a different city/county that implemented this solution]
Description: Describe their specific implementation, including processes changed, technology used, or staff reallocation. Include measurable outcomes they achieved.
Potential Savings: Estimate potential savings for ${organizationName} based on their results.

3. Organization: [Name a different city/county that implemented this solution]
Description: Describe their specific implementation, including processes changed, technology used, or staff reallocation. Include measurable outcomes they achieved.
Potential Savings: Estimate potential savings for ${organizationName} based on their results.

REVENUE-GENERATING SOLUTIONS
Identify 3 specific examples where other cities/counties have generated entrepreneurial revenue to offset subsidization in similar programs:

1. Organization: [Name a specific city/county that implemented this solution]
Description: Describe their specific implementation, including new services offered, fee structures changed, or processes improved. Include measurable outcomes they achieved.
Potential Revenue: Estimate potential revenue for ${organizationName} based on their results.

2. Organization: [Name a different city/county that implemented this solution]
Description: Describe their specific implementation, including new services offered, fee structures changed, or processes improved. Include measurable outcomes they achieved.
Potential Revenue: Estimate potential revenue for ${organizationName} based on their results.

3. Organization: [Name a different city/county that implemented this solution]
Description: Describe their specific implementation, including new services offered, fee structures changed, or processes improved. Include measurable outcomes they achieved.
Potential Revenue: Estimate potential revenue for ${organizationName} based on their results.

Focus on real-world examples and provide specific, measurable outcomes. All solutions should be practical and implementable.`;
  };
  
  const callPerplexityAPI = async (prompt) => {
    try {
      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_PERPLEXITY_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'sonar',
          messages: [{
            role: 'system',
            content: 'You are a precise government program analyst. Provide only structured answers with no narrative or thinking process.'
          }, {
            role: 'user',
            content: prompt
          }]
        })
      });

      if (!response.ok) {
        throw new Error(`API call failed: ${response.status}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (err) {
      console.error('API error:', err);
      throw err;
    }
  };

  const readExcelFile = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          if (!e.target?.result) {
            throw new Error('Failed to read file');
          }
          
          const buffer = e.target.result;
          const workbook = new ExcelJS.Workbook();
          await workbook.xlsx.load(buffer);
          
          const worksheet = workbook.getWorksheet(1);
          if (!worksheet) {
            throw new Error('No worksheet found');
          }
          
          const jsonData = [];
          const headers = [];
          
          worksheet.getRow(1).eachCell((cell) => {
            const value = cell.value?.toString() || '';
            headers.push(value);
          });
          
          worksheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return;
            
            const rowData = {
              'User Group': '',
              'Program': '',
              'Description': '',
              'Total Cost': 0,
              'FTE': 0,
              'Personnel': 0,
              'NonPersonnel': 0
            };
            
            row.eachCell((cell, colNumber) => {
              const header = headers[colNumber - 1];
              if (header && header in rowData) {
                const cellValue = cell.value;
                
                if (['Total Cost', 'FTE', 'Personnel', 'NonPersonnel'].includes(header)) {
                  if (typeof cellValue === 'number') {
                    rowData[header] = cellValue;
                  } else if (typeof cellValue === 'string') {
                    const numValue = parseFloat(cellValue);
                    rowData[header] = isNaN(numValue) ? 0 : numValue;
                  } else {
                    rowData[header] = 0;
                  }
                } else {
                  if (cellValue instanceof Date) {
                    rowData[header] = cellValue.toISOString();
                  } else {
                    rowData[header] = cellValue?.toString() || '';
                  }
                }
              }
            });
            
            jsonData.push(rowData);
          });
          
          resolve(jsonData);
        } catch (error) {
          console.error('Excel processing error:', error);
          reject(new Error(error instanceof Error ? error.message : 'Error processing Excel file'));
        }
      };
      reader.onerror = () => reject(new Error('Error reading file'));
      reader.readAsArrayBuffer(file);
    });
  };

  const handleFileUpload = async (event) => {
    if (!process.env.NEXT_PUBLIC_PERPLEXITY_API_KEY) {
      setError('Perplexity API key not found in environment variables');
      return;
    }

    if (!organizationName) {
      setError('Please enter your organization name first');
      return;
    }

    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const data = await readExcelFile(file);
      const processedPrograms = await processData(data);
      setPrograms(processedPrograms);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const processData = async (data) => {
    const processedPrograms = [];
    
    for (const row of data) {
      const program = {
        department: row['User Group'],
        programName: row['Program'],
        description: row['Description'],
        totalCost: row['Total Cost'] || 0,
        fte: row['FTE'] || 0,
        personnel: row['Personnel'] || 0,
        nonPersonnel: row['NonPersonnel'] || 0
      };

      try {
        const prompt = generatePrompt(program);
        const analysisResult = await callPerplexityAPI(prompt);
        program.analysis = { overview: analysisResult };
        processedPrograms.push(program);
        
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (err) {
        program.error = err instanceof Error ? err.message : 'Analysis failed';
        processedPrograms.push(program);
      }
    }
    
    return processedPrograms;
  };

  const exportToWord = async () => {
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          // Title with better formatting
          new Paragraph({
            children: [
              new TextRun({
                text: `Program Analysis for ${organizationName}`,
                size: 32,
                bold: true,
                font: 'Times New Roman'
              })
            ],
            heading: HeadingLevel.TITLE,
            spacing: { after: 400 },
            alignment: 'center'
          }),
          
          ...programs.flatMap(program => {
            const sections = [
              // Program Name as Heading with blue color
              new Paragraph({
                children: [
                  new TextRun({
                    text: program.programName,
                    size: 28,
                    color: '2B579A',
                    font: 'Times New Roman'
                  })
                ],
                heading: HeadingLevel.HEADING_1,
                spacing: { before: 400, after: 200 }
              }),
  
              // Department info in a cleaner format
              new Paragraph({
                children: [
                  new TextRun({ text: "Department: ", bold: true, font: 'Times New Roman' }),
                  new TextRun({ text: program.department, font: 'Times New Roman' })
                ],
                spacing: { after: 200 }
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: "Total Cost: ", bold: true, font: 'Times New Roman' }),
                  new TextRun({ text: formatCurrency(program.totalCost), font: 'Times New Roman' })
                ]
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: "FTE: ", bold: true, font: 'Times New Roman' }),
                  new TextRun({ text: `${program.fte}`, font: 'Times New Roman' })
                ],
                spacing: { after: 300 }
              })
            ];
  
            // Format analysis content
            if (program.analysis?.overview) {
              const analysisLines = program.analysis.overview.split('\n');
              let currentHeading = '';
              let solutionCount = 0;
  
              analysisLines.forEach(line => {
                if (line.includes('COST-SAVING SOLUTIONS')) {
                  sections.push(
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: "COST-SAVING SOLUTIONS",
                          size: 24,
                          bold: true,
                          font: 'Times New Roman'
                        })
                      ],
                      spacing: { before: 300, after: 200 }
                    })
                  );
                  solutionCount = 0;
                  currentHeading = 'cost-saving';
                } else if (line.includes('REVENUE-GENERATING SOLUTIONS')) {
                  sections.push(
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: "REVENUE-GENERATING SOLUTIONS",
                          size: 24,
                          bold: true,
                          font: 'Times New Roman'
                        })
                      ],
                      spacing: { before: 300, after: 200 }
                    })
                  );
                  solutionCount = 0;
                  currentHeading = 'revenue';
                } else if (line.match(/^\d+\.\s+\*\*Organization/)) {
                  solutionCount++;
                  sections.push(
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: `${solutionCount}. `,
                          bold: true,
                          font: 'Times New Roman'
                        }),
                        new TextRun({
                          text: `Organization: ${line.split('Organization:**:')[1]?.trim()}`,
                          bold: true,
                          font: 'Times New Roman'
                        })
                      ],
                      spacing: { before: 200 }
                    })
                  );
                } else if (line.includes('**Description**:')) {
                  sections.push(
                    new Paragraph({
                      children: [
                        new TextRun({ text: 'Description: ', bold: true, font: 'Times New Roman' }),
                        new TextRun({ 
                          text: line.split('**Description**:')[1]?.trim() || '',
                          font: 'Times New Roman'
                        })
                      ]
                    })
                  );
                } else if (line.includes('**Measurable Outcomes**:')) {
                  sections.push(
                    new Paragraph({
                      children: [
                        new TextRun({ text: 'Measurable Outcomes: ', bold: true, font: 'Times New Roman' }),
                        new TextRun({ 
                          text: line.split('**Measurable Outcomes**:')[1]?.trim() || '',
                          font: 'Times New Roman'
                        })
                      ]
                    })
                  );
                } else if (line.includes('**Potential Savings**:') || line.includes('**Potential Revenue**:')) {
                  const label = line.includes('Savings') ? 'Potential Savings: ' : 'Potential Revenue: ';
                  const content = line.split('**:')[1]?.trim() || '';
                  sections.push(
                    new Paragraph({
                      children: [
                        new TextRun({ text: label, bold: true, font: 'Times New Roman' }),
                        new TextRun({ text: content, font: 'Times New Roman' })
                      ],
                      spacing: { after: 200 }
                    })
                  );
                }
              });
            }
  
            return sections;
          })
        ]
      }]
    });
  
    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${organizationName.replace(/\s+/g, '-')}-Program-Analysis.docx`);
  };
  
  const extractFinancialImpact = (lines) => {
    const fullText = lines.join(' ');
    
    const savingsMatch = fullText.match(/Estimated savings of \$([\d,]+) to \$([\d,]+)/);
    const revenueMatch = fullText.match(/Estimated revenue of \$([\d,]+) to \$([\d,]+)/);
    
    if (savingsMatch) {
      return `$${savingsMatch[1]} - $${savingsMatch[2]} annually`;
    } else if (revenueMatch) {
      return `$${revenueMatch[1]} - $${revenueMatch[2]} annually`;
    }
    
    const dollarMatch = fullText.match(/\$[\d,]+ to \$[\d,]+/);
    if (dollarMatch) {
      return dollarMatch[0] + ' annually';
    }
    
    return 'Not specified';
  };

  const exportToExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Program Analysis');
    
      const headers = [
        'Program Name',
        'Department',
        'Total Cost',
        'FTE',
        'Program Description',
        'Solution Type',
        'Organization',
        'Implementation Details',
        'Financial Impact'
      ];

      const headerRow = worksheet.addRow(headers);
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };
      
      programs.forEach(program => {
        if (!program.analysis?.overview) return;
        
        const sections = program.analysis.overview.split('\n\n');
        let currentSection = '';
        
        sections.forEach(section => {
          if (!section) return;
          
          if (section.includes('COST-SAVING SOLUTIONS')) {
            currentSection = 'Cost Savings';
            return;
          } 
          if (section.includes('REVENUE-GENERATING SOLUTIONS')) {
            currentSection = 'Revenue Generation';
            return;
          } 
          
          if (section.includes('Organization:')) {
            const lines = section.split('\n').filter(line => line.trim());
            
            const organization = lines.find(l => l.includes('Organization:'))?.
              replace('Organization:', '').trim() || 'N/A';
              
            const description = lines.find(l => l.includes('Description:'))?.
              replace('Description:', '').trim() || 'N/A';

            const financialImpact = extractFinancialImpact(lines);

            const row = worksheet.addRow([
              program.programName || 'N/A',
              program.department || 'N/A',
              program.totalCost || 0,
              program.fte || 0,
              program.description || 'N/A',
              currentSection || 'N/A',
              organization,
              description,
              financialImpact
            ]);

            row.getCell(3).numFmt = '$#,##0';
            row.getCell(4).numFmt = '#,##0.00';
            row.getCell(8).alignment = { wrapText: true };
            row.getCell(9).alignment = { wrapText: true };
            
            if (worksheet.rowCount % 2 === 0) {
              row.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFDFDFD' }
              };
            }
          }
        });
      });
      
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      saveAs(blob, `${organizationName.replace(/\s+/g, '-')}-Program-Analysis.xlsx`);
    } catch (error) {
      console.error('Error exporting to Excel:', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  };
  
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-8 bg-gray-50">
      <div className="w-full max-w-4xl bg-white p-8 rounded-lg shadow-sm">
        <h1 className="text-4xl font-bold mb-8 text-gray-800">Program Insights Predictor</h1>
        
        <div className="mb-8">
          <label className="block text-sm font-medium mb-2 text-gray-700">
            Organization Name
          </label>
          <input
            type="text"
            className="w-full p-3 border rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={organizationName}
            onChange={(e) => setOrganizationName(e.target.value)}
            placeholder="e.g., City of Fort Worth, Harris County"
          />
        </div>

        <div className="mb-8">
          <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <p className="mb-2 text-sm text-gray-500">
                <span className="font-semibold">Click to upload</span> or drag and drop
              </p>
              <p className="text-xs text-gray-500">Excel or CSV files</p>
            </div>
            <input 
              type="file" 
              className="hidden" 
              accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload}
            />
          </label>
        </div>

        {programs.length > 0 && (
          <div className="flex space-x-4 mb-8">
            <button
              onClick={exportToWord}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Export to Word
            </button>
            <button
              onClick={exportToExcel}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Export to Excel
            </button>
          </div>
        )}

        {error && (
          <div className="mb-8 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">
            {error}
          </div>
        )}

        {loading && (
          <div className="mb-8 p-4 bg-blue-50 text-blue-700 rounded-lg border border-blue-200 flex items-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-700 mr-3"></div>
            Processing programs and generating insights...
          </div>
        )}

        {programs.map((program, index) => (
          <div key={index} className="mb-8 p-6 bg-white rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-2xl font-bold mb-2 text-gray-800">{program.programName}</h2>
            <div className="text-gray-600 mb-4 flex flex-wrap gap-4">
              <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
                {program.department}
              </span>
              <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm">
                {formatCurrency(program.totalCost)}
              </span>
              {program.fte && (
                <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm">
                  {program.fte} FTE
                </span>
              )}
            </div>
            
            {program.error ? (
              <div className="text-red-600 bg-red-50 p-4 rounded-lg">
                Error: {program.error}
              </div>
            ) : (
              <div className="prose max-w-none">
                <div className="bg-gray-50 p-4 rounded-lg whitespace-pre-wrap font-mono text-sm">
                  {program.analysis?.overview}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}