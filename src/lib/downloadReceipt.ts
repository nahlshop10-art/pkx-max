export async function downloadReceiptAsJPG(element: HTMLElement, orderId: string) {
  try {
    const { toJpeg } = await import('html-to-image');
    const dataUrl = await toJpeg(element, {
      cacheBust: true,
      backgroundColor: '#f3f1ed',
      pixelRatio: 2,
      skipFonts: true,
      quality: 0.95
    });
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `Receipt_${orderId}.jpg`;
    link.click();
  } catch (err) {
    console.error('Error generating image:', err);
  }
}

export async function downloadReceiptAsPDF(element: HTMLElement, orderId: string) {
  try {
    const { toCanvas } = await import('html-to-image');
    const { jsPDF } = await import('jspdf');

    const canvas = await toCanvas(element, {
      cacheBust: true,
      backgroundColor: '#f3f1ed',
      pixelRatio: 2,
      skipFonts: true,
    });
    const imgData = canvas.toDataURL('image/jpeg', 1.0);
    
    // Calculate PDF dimensions based on A4 width and the image's aspect ratio
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    // Maintain aspect ratio: pdfHeight = (pdfWidth * canvas.height) / canvas.width
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    // If the content is longer than A4, jspdf will just put it on one page 
    // extending the page length if we set it, or we can just create a custom sized PDF
    const customPdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [pdfWidth, pdfHeight],
    });

    customPdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
    customPdf.save(`Receipt_${orderId}.pdf`);
  } catch (err) {
    console.error('Error generating PDF:', err);
  }
}
