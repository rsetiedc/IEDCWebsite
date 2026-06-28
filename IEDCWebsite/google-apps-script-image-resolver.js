/**
 * Google Apps Script - Image Link Auto-Resolver for RSET IEDC Events Sheet
 * 
 * This script automatically runs whenever the events sheet is edited.
 * If a user pastes a sharing link (such as a Kommodo.ai or Google Drive link)
 * in the "Cover_Image" column, it will automatically resolve it to the direct,
 * raw image URL and overwrite the cell.
 * 
 * ═══════════════════════════════════════════════════════════════
 *   DEPLOYMENT INSTRUCTIONS (Critical for authorization)
 * ═══════════════════════════════════════════════════════════════
 * 1. Open your Master Google Sheet.
 * 2. Go to Extensions -> Apps Script.
 * 3. Delete any code in the editor and paste this entire script.
 * 4. Click the Save (💾) button.
 * 5. Set up an installable trigger (so the script has permission to fetch external pages):
 *    - Click the Clock icon (Triggers) on the left sidebar.
 *    - Click "+ Add Trigger" in the bottom right.
 *    - Choose function to run: "installedOnEdit"
 *    - Choose which deployment should run: "Head"
 *    - Select event source: "From spreadsheet"
 *    - Select event type: "On edit"
 *    - Click "Save". Grant permissions when prompted.
 */

function installedOnEdit(e) {
  var range = e.range;
  var sheet = range.getSheet();
  
  // Only monitor the active sheet (e.g. your events configuration sheet)
  // Get the header row to find the Cover_Image column index
  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var coverImageColIdx = headers.indexOf('Cover_Image') + 1;
  
  // If Cover_Image column is not found, do nothing
  if (coverImageColIdx === 0) return;
  
  // Check if edited cell is in the Cover_Image column and not the header row
  if (range.getColumn() === coverImageColIdx && range.getRow() > 1) {
    var rawValue = range.getValue().toString().trim();
    if (!rawValue) return;
    
    var resolvedUrl = resolveToDirectImageUrl(rawValue);
    if (resolvedUrl && resolvedUrl !== rawValue) {
      range.setValue(resolvedUrl);
    }
  }
}

/**
 * Resolves a sharing link to a direct image URL
 */
function resolveToDirectImageUrl(url) {
  try {
    // 1. Google Drive Links
    var driveFileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/i);
    if (driveFileMatch && driveFileMatch[1]) {
      return 'https://lh3.googleusercontent.com/d/' + driveFileMatch[1];
    }
    var driveIdMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/i);
    if (driveIdMatch && driveIdMatch[1] && url.indexOf('google.com') !== -1) {
      return 'https://lh3.googleusercontent.com/d/' + driveIdMatch[1];
    }
    
    // 2. Dropbox Links
    if (url.indexOf('dropbox.com') !== -1) {
      return url.replace(/\?dl=\d/i, '').replace(/&dl=\d/i, '') + (url.indexOf('?') !== -1 ? '&raw=1' : '?raw=1');
    }
    
    // 3. Kommodo.ai Links
    var kommodoMatch = url.match(/https?:\/\/(?:www\.)?kommodo\.ai\/i\/([a-zA-Z0-9_-]+)/i);
    if (kommodoMatch && kommodoMatch[0]) {
      var response = UrlFetchApp.fetch(kommodoMatch[0], { muteHttpExceptions: true });
      if (response.getResponseCode() === 200) {
        var html = response.getContentText();
        // Extract og:image meta tag content
        var ogImageMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i) ||
                           html.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:image["']/i);
        if (ogImageMatch && ogImageMatch[1]) {
          return ogImageMatch[1];
        }
      }
    }
  } catch (err) {
    console.error('Error resolving image URL: ' + err.toString());
  }
  return url;
}
