/**
 * Google Apps Script - Sync Form Submissions to a Specific Sheet
 * 
 * Paste this script into the Script Editor of your Google Form.
 * When a response is submitted, it will look up the event configuration
 * in your master events sheet and append the response to the target sheet
 * specified in the "Reg_sheet" column.
 */

// Master Events Spreadsheet (configuration sheet)
var MASTER_SPREADSHEET_ID = '1rZUeS3HQUzrKHRNR1nplt5cdkHWK0h-wDOsjmGSSHp4';

function onFormSubmit(e) {
  try {
    var form = FormApp.getActiveForm();
    var formUrl = form.getPublishedUrl();
    var formId = form.getId();
    
    // 1. Get the responses
    var response = e.response;
    var itemResponses = response.getItemResponses();
    var timestamp = response.getTimestamp();
    var email = response.getRespondentEmail();
    
    // Map items
    var name = '';
    var organization = '';
    var days = '';
    var dietary = '';
    var acknowledge = '';
    
    for (var i = 0; i < itemResponses.length; i++) {
      var title = itemResponses[i].getItem().getTitle().toLowerCase();
      var value = itemResponses[i].getResponse();
      
      if (title.indexOf('name') !== -1) {
        name = value;
      } else if (title.indexOf('organization') !== -1 || title.indexOf('college') !== -1) {
        organization = value;
      } else if (title.indexOf('days') !== -1) {
        days = Array.isArray(value) ? value.join(', ') : value;
      } else if (title.indexOf('dietary') !== -1) {
        dietary = value;
      } else if (title.indexOf('understand') !== -1 || title.indexOf('acknowledge') !== -1 || title.indexOf('pay') !== -1) {
        acknowledge = value;
      }
    }
    
    // 2. Find the destination sheet URL from the Master sheet
    var masterSpreadsheet = SpreadsheetApp.openById(MASTER_SPREADSHEET_ID);
    var masterSheet = masterSpreadsheet.getActiveSheet();
    var dataRange = masterSheet.getDataRange();
    var values = dataRange.getValues();
    var headers = values[0];
    
    var regFormIdx = headers.indexOf('Reg_Form');
    var regSheetIdx = headers.indexOf('Reg_sheet');
    var eventTitleIdx = headers.indexOf('Event_Title');
    
    var targetSheetUrl = '';
    var eventTitle = '';
    
    // Look up the row that matches this Google Form URL
    for (var r = 1; r < values.length; r++) {
      var rowFormUrl = values[r][regFormIdx];
      if (rowFormUrl && (rowFormUrl.indexOf(formId) !== -1 || formUrl.indexOf(rowFormUrl) !== -1)) {
        targetSheetUrl = values[r][regSheetIdx];
        eventTitle = values[r][eventTitleIdx];
        break;
      }
    }
    
    // 3. Append to the target response sheet
    if (targetSheetUrl) {
      var targetSpreadsheet = SpreadsheetApp.openByUrl(targetSheetUrl);
      var targetSheet = targetSpreadsheet.getActiveSheet();
      
      // Initialize headers if empty
      if (targetSheet.getLastRow() === 0) {
        targetSheet.appendRow([
          'Timestamp',
          'Event',
          'Name',
          'Email',
          'Organization',
          'Days Attending',
          'Dietary Restrictions',
          'Acknowledgment'
        ]);
        
        var headerRange = targetSheet.getRange(1, 1, 1, 8);
        headerRange.setFontWeight('bold');
        headerRange.setBackground('#FF6F0F');
        headerRange.setFontColor('#FFFFFF');
      }
      
      // Append row
      targetSheet.appendRow([
        timestamp,
        eventTitle || form.getTitle(),
        name,
        email || response.getRespondentEmail(),
        organization,
        days,
        dietary,
        acknowledge
      ]);
    } else {
      console.warn('Could not find destination Reg_sheet for Form ID: ' + formId);
    }
    
  } catch (error) {
    console.error('Error syncing response: ' + error.toString());
  }
}
