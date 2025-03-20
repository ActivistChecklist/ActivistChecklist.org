'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

// PDF icon component
const PdfIcon = () => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width="16" 
    height="16" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className="h-4 w-4"
  >
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
    <path d="M8 13h2" />
    <path d="M8 17h2" />
    <path d="M14 13h2" />
    <path d="M14 17h2" />
  </svg>
);

const SaveAsPdfButton = ({ 
  targetElementId = 'main-content', 
  filename = 'document.pdf',
  className = '',
  variant = 'defaultOutline',
  size = 'sm'
}) => {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleSaveAsPdf = async () => {
    try {
      setIsGenerating(true);
      
      // Dynamically import html2pdf to avoid SSR issues
      const html2pdf = (await import('html2pdf.js')).default;
      
      const element = document.getElementById(targetElementId);
      if (!element) {
        console.error(`Element with ID "${targetElementId}" not found`);
        return;
      }

      // Add a class to the body to trigger print styles
      document.body.classList.add('print-pdf-mode');
      
      // Configure html2pdf options
      const opt = {
        margin: [10, 10, 10, 10], // [top, left, bottom, right] in mm
        filename: filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 2,
          useCORS: true,
          logging: false
        },
        jsPDF: { 
          unit: 'mm', 
          format: 'a4', 
          orientation: 'portrait' 
        },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      };

      // Generate PDF with print styling
      await html2pdf().set(opt).from(element).save();
      
      // Remove the print class
      document.body.classList.remove('print-pdf-mode');
      
      console.log('PDF generated successfully');
    } catch (error) {
      console.error('Error generating PDF:', error);
      // Make sure to remove the class even if there's an error
      document.body.classList.remove('print-pdf-mode');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Button
      onClick={handleSaveAsPdf}
      disabled={isGenerating}
      className={`gap-2 printpdf:hidden ${className}`}
      variant={variant}
      size={size}
    >
      {isGenerating ? 'Generating...' : (
        <>
          <PdfIcon />
          Save as PDF
        </>
      )}
    </Button>
  );
};

export default SaveAsPdfButton; 