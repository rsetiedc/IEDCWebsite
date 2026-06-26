/**
 * Google Apps Script — RSET IEDC Registration Form Proxy
 * 
 * This script receives form submissions from the RSET IEDC website
 * and appends them as rows to the response Google Sheet.
 * 
 * ═══════════════════════════════════════════════════════════════
 *   DEPLOYMENT INSTRUCTIONS (takes ~2 minutes)
 * ═══════════════════════════════════════════════════════════════
 * 
 * 1. Go to https://script.google.com/
 * 2. Click "New Project"
 * 3. Delete the default code and paste this entire file
 * 4. Click the Save (💾) button, name the project "IEDC Registration Proxy"
 * 5. Click Deploy → New Deployment
 * 6. Select type: "Web app"
 * 7. Set:
 *    - Description: "IEDC Registration Proxy"
 *    - Execute as: "Me"
 *    - Who has access: "Anyone"
 * 8. Click "Deploy"
 * 9. Copy the Web App URL
 * 10. Paste it into js/registration-form.js in the APPS_SCRIPT_URL variable
 * 
 * ═══════════════════════════════════════════════════════════════
 */

// Target Google Sheet ID (the response sheet)
var SPREADSHEET_ID = '15HEEJFKa8hYKA-e__T8kqssTQXQmUxKS0FbWB1JSrO4';

/**
 * Handle POST requests from the website
 */
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    
    var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getActiveSheet();
    
    // Add headers if the sheet is empty
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        'Timestamp',
        'Event',
        'Name',
        'Email',
        'Organization',
        'Days Attending',
        'Dietary Restrictions',
        'Acknowledgment'
      ]);
      
      // Format header row
      var headerRange = sheet.getRange(1, 1, 1, 8);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#FF6F0F');
      headerRange.setFontColor('#FFFFFF');
    }
    
    // Append the data row
    sheet.appendRow([
      data.timestamp || new Date().toISOString(),
      data.eventTitle || '',
      data.name || '',
      data.email || '',
      data.organization || '',
      data.days || '',
      data.dietary || '',
      data.acknowledge || ''
    ]);
    
    // Return success
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'success', message: 'Registration recorded' }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    // Return error
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handle GET requests (for testing)
 */
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', message: 'IEDC Registration Proxy is running' }))
    .setMimeType(ContentService.MimeType.JSON);
}
