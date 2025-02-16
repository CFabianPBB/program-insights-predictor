"use client";

import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { Document, Paragraph, Packer, HeadingLevel, TextRun } from 'docx';
import { saveAs } from 'file-saver';

interface Program {
  department: string;
  programName: string;
  description: string;
  totalCost: number;
  fte?: number;
  personnel?: number;
  nonPersonnel?: number;
  analysis?: {
    overview?: string;
    costSavings?: Array<{
      organization: string;
      description: string;
      potentialSavings: string;
    }>;
    revenueGeneration?: Array<{
      organization: string;
      description: string;
      potentialRevenue: string;
    }>;
  };
  error?: string;
}

interface Analysis {
  programDetails: {
    organization: string;
    department: string;
    program: string;
    description: string;
    totalCost: string;
    fte: string;
  };
  costSavingSolutions: Array<{
    organization: string;
    description: string;
    potentialSavings: string;
  }>;
  revenueGeneratingSolutions: Array<{
    organization: string;
    description: string;
    potentialRevenue: string;
  }>;
}
export default function Home() {
  const [apiKey, setApiKey] = useState(process.env.NEXT_PUBLIC_PERPLEXITY_API_KEY || '');
  const [organizationName, setOrganizationName] = useState('');
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rawData, setRawData] = useState<any>(null);

  const generatePrompt = (program: Program) => {
    return `Analyze this government program and provide ONLY the following sections with their exact headers. DO NOT include any additional narrative or thinking process:

PROGRAM DETAILS
Organization: ${organizationName}
Department: ${program.department}
Program: ${program.programName}
Description: ${program.description || 'Not provided'}
Total Cost: $${program.totalCost?.toLocaleString() || 'Not provided'}
FTE: ${program.fte || 'Not provided'}

COST-SAVING SOLUTIONS

1. Organization: [City/County/State]
Description: [Provide 4-5 detailed sentences about the specific solution implemented. Include implementation details, challenges overcome, specific processes changed, and measurable outcomes achieved. Be specific about the methods used and results obtained.]
Potential Savings: [Specific estimate for ${organizationName}]

2. Organization: [Different City/County/State]
Description: [Provide 4-5 detailed sentences about the specific solution implemented. Include implementation details, challenges overcome, specific processes changed, and measurable outcomes achieved. Be specific about the methods used and results obtained.]
Potential Savings: [Specific estimate for ${organizationName}]

3. Organization: [Different City/County/State]
Description: [Provide 4-5 detailed sentences about the specific solution implemented. Include implementation details, challenges overcome, specific processes changed, and measurable outcomes achieved. Be specific about the methods used and results obtained.]
Potential Savings: [Specific estimate for ${organizationName}]

REVENUE-GENERATING SOLUTIONS

1. Organization: [City/County/State]
Description: [Provide 4-5 detailed sentences about the specific solution implemented. Include implementation details, challenges overcome, specific processes changed, and measurable outcomes achieved. Be specific about the methods used and results obtained.]
Potential Revenue: [Specific estimate for ${organizationName}]

2. Organization: [Different City/County/State]
Description: [Provide 4-5 detailed sentences about the specific solution implemented. Include implementation details, challenges overcome, specific processes changed, and measurable outcomes achieved. Be specific about the methods used and results obtained.]
Potential Revenue: [Specific estimate for ${organizationName}]

3. Organization: [Different City/County/State]
Description: [Provide 4-5 detailed sentences about the specific solution implemented. Include implementation details, challenges overcome, specific processes changed, and measurable outcomes achieved. Be specific about the methods used and results obtained.]
Potential Revenue: [Specific estimate for ${organizationName}]

Required:
- Each description must be 4-5 detailed sentences
- Include specific implementation details and measurable results
- Use only real examples from different organizations
- Focus on practical, implemented solutions
- Make estimates proportional to ${organizationName}'s program size and scope
- DO NOT include any analysis narrative or thinking process
- DO NOT include any text starting with "think" or "let me"`;
  };
  const callPerplexityAPI = async (prompt: string) => {
    try {
      console.log("Making API call...");
      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          model: 'sonar',  // Changed from sonar-reasoning to get more direct responses
          messages: [{
            role: 'system',
            content: 'You are a precise government program analyst. Provide only structured analysis with no narrative or thinking process.'
          }, {
            role: 'user',
            content: prompt
          }]
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Full error response:", errorText);
        throw new Error(`API call failed: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      console.log("API response received");
      return data.choices[0].message.content;
    } catch (error) {
      console.error('Detailed API error:', error);
      throw error;
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log("File upload triggered");
    
    if (!apiKey) {
      setError('Please enter your Perplexity API key first');
      return;
    }

    if (!organizationName) {
      setError('Please enter your organization name first');
      return;
    }

    const file = event.target.files?.[0];
    if (!file) {
      console.log("No file selected");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log("Reading Excel file...");
      const data = await readExcelFile(file);
      setRawData(data);
      console.log("Processing data...");
      const processedPrograms = await processData(data);
      setPrograms(processedPrograms);
    } catch (err) {
      console.error("Error:", err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const readExcelFile = (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet);
          resolve(jsonData);
        } catch (error) {
          reject(new Error('Error processing Excel file'));
        }
      };
      reader.onerror = () => reject(new Error('Error reading file'));
      reader.readAsArrayBuffer(file);
    });
  };
  const processData = async (data: any[]): Promise<Program[]> => {
    const processedPrograms: Program[] = [];
    
    for (const row of data) {
      const program: Program = {
        department: row['User Group'] || '',
        programName: row['Program'] || '',
        description: row['Description'] || '',
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
      } catch (error) {
        program.error = error instanceof Error ? error.message : 'Analysis failed';
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
          new Paragraph({
            text: `Program Analysis for ${organizationName}`,
            heading: HeadingLevel.TITLE,
            spacing: {
              after: 400
            }
          }),
          ...programs.flatMap(program => {
            const sections = [
              new Paragraph({
                text: program.programName,
                heading: HeadingLevel.HEADING_1,
                spacing: {
                  before: 400,
                  after: 200
                }
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: 'Department: ', bold: true }),
                  new TextRun(program.department)
                ]
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: 'Total Cost: ', bold: true }),
                  new TextRun(formatCurrency(program.totalCost))
                ]
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: 'FTE: ', bold: true }),
                  new TextRun(program.fte?.toString() || 'N/A')
                ],
                spacing: {
                  after: 200
                }
              })
            ];

            if (program.analysis?.overview) {
              const analysisText = program.analysis.overview
                .split('\n')
                .filter(line => !line.toLowerCase().includes('<think>'))
                .join('\n');

              sections.push(
                new Paragraph({
                  text: analysisText,
                  spacing: {
                    before: 200,
                    after: 400
                  }
                })
              );
            }

            return sections;
          })
        ]
      }]
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${organizationName.replace(/\s+/g, '-')}-Program-Analysis.docx`);
  };

  const exportToExcel = () => {
    const excelData = programs.flatMap(program => {
      if (!program.analysis?.overview) return [];

      const rows = [];
      const sections = program.analysis.overview.split('\n\n');
      
      let currentSection = '';
      let currentItem: any = {
        'Program Name': program.programName,
        'Department': program.department,
        'Total Cost': program.totalCost,
        'FTE': program.fte
      };

      for (const section of sections) {
        if (section.includes('COST-SAVING SOLUTIONS')) {
          currentSection = 'cost-saving';
          continue;
        } else if (section.includes('REVENUE-GENERATING SOLUTIONS')) {
          currentSection = 'revenue';
          continue;
        }

        if (section.includes('Organization:')) {
          if (Object.keys(currentItem).length > 4) {
            rows.push(currentItem);
            currentItem = {
              'Program Name': '',
              'Department': '',
              'Total Cost': '',
              'FTE': ''
            };
          }

          const lines = section.split('\n');
          currentItem['Solution Type'] = currentSection === 'cost-saving' ? 'Cost Savings' : 'Revenue Generation';
          currentItem['Organization'] = lines[0].replace('Organization:', '').trim();
          currentItem['Description'] = lines[1].replace('Description:', '').trim();
          currentItem['Potential Impact'] = lines[2].replace(
            currentSection === 'cost-saving' ? 'Potential Savings:' : 'Potential Revenue:', 
            ''
          ).trim();
        }
      }

      if (Object.keys(currentItem).length > 4) {
        rows.push(currentItem);
      }

      return rows;
    });

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Program Analysis');
    
    // Auto-size columns
    const colWidths = excelData.reduce((widths: any, row) => {
      Object.entries(row).forEach(([key, value]) => {
        const length = value ? value.toString().length : 0;
        widths[key] = Math.max(widths[key] || 0, length);
      });
      return widths;
    }, {});

    ws['!cols'] = Object.values(colWidths).map(width => ({ wch: Math.min(width + 2, 50) }));

    XLSX.writeFile(wb, `${organizationName.replace(/\s+/g, '-')}-Program-Analysis.xlsx`);
  };

  const formatCurrency = (amount: number): string => {
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
        <h1 className="text-4xl font-bold mb-8 text-gray-800">Program Insights Analyzer</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700">
              Perplexity API Key
            </label>
            <input
              type="password"
              className="w-full p-3 border rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your Perplexity API key"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700">
              Organization Name
            </label>
            <input
              type="text"
              className="w-full p-3 border rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              placeholder="e.g., City of Fort Worth, Harris County, Miami-Dade Public Schools"
            />
          </div>
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