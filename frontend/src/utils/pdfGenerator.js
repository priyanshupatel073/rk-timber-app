import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Generates an A4 PDF from a DOM element using html2canvas & jsPDF
 * @param {HTMLElement} element 
 * @param {string} filename 
 * @returns {Promise<{ blob: Blob, pdf: jsPDF, filename: string }>}
 */
export async function generateInvoicePdf(element, filename = 'Invoice.pdf') {
  if (!element) {
    throw new Error('Invoice element not found');
  }

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#FFFFFF',
    logging: false,
    windowWidth: 1024,
    ignoreElements: (el) => {
      return el.classList.contains('no-print') || 
             el.hasAttribute('data-html2canvas-ignore') ||
             el.classList.contains('btn-icon') ||
             el.classList.contains('mobile-table-swipe-hint');
    },
    onclone: (clonedDoc) => {
      // 1. Force the cloned invoice canvas to standard desktop A4 proportions regardless of device screen size
      const clonedCanvas = clonedDoc.querySelector('.invoice-paper-canvas');
      if (clonedCanvas) {
        clonedCanvas.style.setProperty('width', '800px', 'important');
        clonedCanvas.style.setProperty('max-width', '800px', 'important');
        clonedCanvas.style.setProperty('min-width', '800px', 'important');
        clonedCanvas.style.setProperty('min-height', '1080px', 'important');
        clonedCanvas.style.setProperty('padding', '28px 32px', 'important');
        clonedCanvas.style.setProperty('margin', '0 auto', 'important');
        clonedCanvas.style.setProperty('box-sizing', 'border-box', 'important');
        clonedCanvas.style.setProperty('border', '1.5px solid #1E1B4B', 'important');
      }

      // 2. Force desktop header layout (Logo left, title center, badge right)
      const headerGrid = clonedDoc.querySelector('.invoice-header-grid');
      if (headerGrid) {
        headerGrid.style.setProperty('display', 'grid', 'important');
        headerGrid.style.setProperty('grid-template-columns', 'auto 1fr auto', 'important');
        headerGrid.style.setProperty('gap', '14px', 'important');
        headerGrid.style.setProperty('align-items', 'center', 'important');
        headerGrid.style.setProperty('margin-bottom', '8px', 'important');
        headerGrid.style.setProperty('text-align', 'center', 'important');
      }

      const logoImg = clonedDoc.querySelector('.invoice-header-grid img');
      if (logoImg) {
        logoImg.style.setProperty('height', '84px', 'important');
        logoImg.style.setProperty('max-height', '84px', 'important');
        logoImg.style.setProperty('width', 'auto', 'important');
        logoImg.style.setProperty('display', 'block', 'important');
      }

      const headerH1 = clonedDoc.querySelector('.invoice-header-grid h1');
      if (headerH1) {
        headerH1.style.setProperty('font-size', '1.85rem', 'important');
        headerH1.style.setProperty('line-height', '1.1', 'important');
      }

      // 3. Force desktop 2-column partitioned meta grid
      const metaGrid = clonedDoc.querySelector('.invoice-meta-grid');
      if (metaGrid) {
        metaGrid.style.setProperty('display', 'grid', 'important');
        metaGrid.style.setProperty('grid-template-columns', '1fr 1.25fr', 'important');
        metaGrid.style.setProperty('gap', '0px', 'important');
      }

      const metaLeft = clonedDoc.querySelector('.invoice-meta-left');
      if (metaLeft) {
        metaLeft.style.setProperty('border-right', '1.5px solid #1E1B4B', 'important');
        metaLeft.style.setProperty('border-bottom', 'none', 'important');
        metaLeft.style.setProperty('padding', '8px 12px', 'important');
      }

      const metaRight = clonedDoc.querySelector('.invoice-meta-right');
      if (metaRight) {
        metaRight.style.setProperty('padding', '8px 12px', 'important');
      }

      // 4. Force desktop footer grid
      const footerGrid = clonedDoc.querySelector('.invoice-footer-grid');
      if (footerGrid) {
        footerGrid.style.setProperty('display', 'grid', 'important');
        footerGrid.style.setProperty('grid-template-columns', '1.7fr 1.3fr', 'important');
      }

      const footerLeft = clonedDoc.querySelector('.invoice-footer-left');
      if (footerLeft) {
        footerLeft.style.setProperty('border-right', '1.5px solid #1E1B4B', 'important');
        footerLeft.style.setProperty('border-bottom', 'none', 'important');
        footerLeft.style.setProperty('padding', '8px 12px', 'important');
      }

      const footerRight = clonedDoc.querySelector('.invoice-footer-right');
      if (footerRight) {
        footerRight.style.setProperty('padding', '8px 12px', 'important');
        footerRight.style.setProperty('min-height', '90px', 'important');
      }

      // 5. Force items table to full width
      const gridTable = clonedDoc.querySelector('.invoice-grid-table');
      if (gridTable) {
        gridTable.style.setProperty('width', '100%', 'important');
        gridTable.style.setProperty('min-width', '100%', 'important');
      }

      // 6. Remove all delete buttons, action toolbars, swipe hints, and no-print elements
      clonedDoc.querySelectorAll('.no-print, [data-html2canvas-ignore="true"], .btn-icon, button, .mobile-table-swipe-hint').forEach(el => {
        el.remove();
      });

      // 7. Hide all interactive screen input fields
      clonedDoc.querySelectorAll('.screen-only').forEach(el => {
        el.style.setProperty('display', 'none', 'important');
      });

      // 8. Show all print-only clean text elements
      clonedDoc.querySelectorAll('.print-only').forEach(el => {
        if (el.tagName === 'SPAN') {
          el.style.setProperty('display', 'inline-block', 'important');
        } else {
          el.style.setProperty('display', 'block', 'important');
        }
      });
    }
  });

  const imgData = canvas.toDataURL('image/jpeg', 0.98);
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 8;
  const marginY = 8;
  const imgWidth = pageWidth - (marginX * 2);
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  pdf.addImage(imgData, 'JPEG', marginX, marginY, imgWidth, Math.min(imgHeight, pageHeight - (marginY * 2)));
  const blob = pdf.output('blob');

  return { blob, pdf, filename };
}

/**
 * Downloads a Blob as a file in the browser
 */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
