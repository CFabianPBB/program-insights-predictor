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

Based on real examples from other similar organizations in the United States, provide:

COST-SAVING SOLUTIONS
Identify 3 specific examples referencing the names of other cities/counties who have reduced costs and saved money by achieving a program efficiency, creating a shared service model to share costs, centralizing services within their organization, or otherwise minimized costs in similar programs:

1. Organization: [Name a specific city/county that implemented this solution]
Description: Describe their specific implementation, including processes changed, technology used, or staff reallocation. Include measurable outcomes they achieved.
Potential Savings: Estimate potential savings for ${organizationName} based on their results.

2. Organization: [Name a different, and specific city/county that implemented this solution]
Description: Describe their specific implementation, including processes changed, technology used, or staff reallocation. Include measurable outcomes they achieved.
Potential Savings: Estimate potential savings for ${organizationName} based on their results.

3. Organization: [Name a different, and specific city/county that implemented this solution]
Description: Describe their specific implementation, including processes changed, technology used, or staff reallocation. Include measurable outcomes they achieved.
Potential Savings: Estimate potential savings for ${organizationName} based on their results.

REVENUE-GENERATING SOLUTIONS
Identify 3 specific examples where other cities/counties have implemented an alternative revenue strategy, a creative new fee, acted entrepreneurial like a business to bring in new revenue, or successfully attained a grant to offset subsidization in similar programs:

1. Organization: [Name a specific city/county that implemented this solution]
Description: Describe their specific implementation, including new services offered, fee structures changed, or processes improved. Include measurable outcomes they achieved.
Potential Revenue: Estimate potential revenue for ${organizationName} based on their results.

2. Organization: [Name a different, and specific city/county that implemented this solution]
Description: Describe their specific implementation, including new services offered, fee structures changed, or processes improved. Include measurable outcomes they achieved.
Potential Revenue: Estimate potential revenue for ${organizationName} based on their results.

3. Organization: [Name a different, and specific city/county that implemented this solution]
Description: Describe their specific implementation, including new services offered, fee structures changed, or processes improved. Include measurable outcomes they achieved.
Potential Revenue: Estimate potential revenue for ${organizationName} based on their results.

Focus on real-world examples and provide specific, measurable outcomes. All solutions should be practical and implementable. Please ensure all descriptions are at least 4 sentences.`;
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
          // Title
          new Paragraph({
            text: `Program Analysis for ${organizationName}`,
            heading: HeadingLevel.TITLE,
            spacing: { after: 400 },
            alignment: 'center'
          }),
          
          ...programs.flatMap(program => {
            const sections = [
              // Program Name as Heading
              new Paragraph({
                text: program.programName,
                heading: HeadingLevel.HEADING_1,
                spacing: { before: 400, after: 200 }
              }),
  
              // Department info with proper styling
              new Paragraph({
                children: [
                  new TextRun({ text: "Department: ", bold: true }),
                  new TextRun(program.department)
                ],
                spacing: { after: 200 }
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: "Total Cost: ", bold: true }),
                  new TextRun(formatCurrency(program.totalCost))
                ]
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: "FTE: ", bold: true }),
                  new TextRun(`${program.fte}`),
                ],
                spacing: { after: 200 }
              })
            ];
  
            // Format analysis content
            if (program.analysis?.overview) {
              const analysisLines = program.analysis.overview.split('\n');
              let currentHeading = '';
  
              analysisLines.forEach(line => {
                if (line.includes('COST-SAVING SOLUTIONS')) {
                  sections.push(
                    new Paragraph({
                      text: "COST-SAVING SOLUTIONS",
                      heading: HeadingLevel.HEADING_2,
                      spacing: { before: 200, after: 200 }
                    })
                  );
                  currentHeading = 'cost-saving';
                } else if (line.includes('REVENUE-GENERATING SOLUTIONS')) {
                  sections.push(
                    new Paragraph({
                      text: "REVENUE-GENERATING SOLUTIONS",
                      heading: HeadingLevel.HEADING_2,
                      spacing: { before: 200, after: 200 }
                    })
                  );
                  currentHeading = 'revenue';
                } else if (line.includes('Organization:')) {
                  sections.push(
                    new Paragraph({
                      children: [
                        new TextRun({ text: line.replace('Organization:', 'Organization: '), bold: true })
                      ],
                      spacing: { before: 200 }
                    })
                  );
                } else if (line.includes('Description:')) {
                  sections.push(
                    new Paragraph({
                      children: [
                        new TextRun({ text: 'Description: ', bold: true }),
                        new TextRun(line.replace('Description:', '').trim())
                      ]
                    })
                  );
                } else if (line.includes('Measurable Outcomes:')) {
                  sections.push(
                    new Paragraph({
                      children: [
                        new TextRun({ text: 'Measurable Outcomes: ', bold: true }),
                        new TextRun(line.replace('Measurable Outcomes:', '').trim())
                      ]
                    })
                  );
                } else if (line.includes('Potential Savings:') || line.includes('Potential Revenue:')) {
                  sections.push(
                    new Paragraph({
                      children: [
                        new TextRun({ 
                          text: line.includes('Savings') ? 'Potential Savings: ' : 'Potential Revenue: ', 
                          bold: true 
                        }),
                        new TextRun(line.replace(/(Potential Savings:|Potential Revenue:)/, '').trim())
                      ],
                      spacing: { after: 200 }
                    })
                  );
                } else if (line.trim()) {
                  sections.push(
                    new Paragraph({
                      text: line,
                      spacing: { after: 100 }
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
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="bg-slate-700 text-white py-10 px-6">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-4xl font-bold mb-3">Program Insights Predictor</h1>
          <p className="text-xl">Upload your program data to generate cost-saving and revenue insights based on real-world examples</p>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="flex-grow p-6 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Organization Information</h2>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Organization Name
              </label>
              <input
                type="text"
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                placeholder="e.g., City of Fort Worth, Harris County"
                className="w-full p-3 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Upload Program Data</h2>
            <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer bg-blue-50 hover:bg-blue-100 border-blue-300 transition-colors">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <svg className="w-12 h-12 text-blue-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="mb-2 text-sm font-medium text-blue-700">
                  <span className="font-semibold">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-blue-600">Excel or CSV files</p>
              </div>
              <input 
                type="file" 
                className="hidden" 
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
              />
            </label>
          </div>
          
          {error && (
            <div className="bg-white rounded-lg shadow-md p-4 mb-6 border-l-4 border-red-500 bg-red-50">
              <div className="flex items-center">
                <svg className="w-6 h-6 text-red-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-red-700">{error}</p>
              </div>
            </div>
          )}

          {loading && (
            <div className="bg-white rounded-lg shadow-md p-4 mb-6 border-l-4 border-blue-500 bg-blue-50">
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-700 mr-3"></div>
                <p className="text-blue-700">Processing programs and generating insights...</p>
              </div>
            </div>
          )}
          
          {programs.length > 0 && (
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">Analysis Results</h2>
              <div className="flex space-x-4 mb-6">
                <button
                  onClick={exportToWord}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Export to Word
                </button>
                <button
                  onClick={exportToExcel}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Export to Excel
                </button>
              </div>
              
              {programs.map((program, index) => (
                <div key={index} className="mb-6 p-6 bg-white rounded-lg border border-gray-200 shadow-sm">
                  <h3 className="text-2xl font-bold mb-2 text-gray-800">{program.programName}</h3>
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
          )}
        </div>
      </main>
      
      {/* Footer */}
      <footer className="bg-slate-800 text-white py-4 px-6">
        <div className="max-w-5xl mx-auto text-center text-sm">
          <p>© 2025 Program Insights Predictor | City Budget Management Solutions</p>
        </div>
      </footer>
    </div>
  );
}