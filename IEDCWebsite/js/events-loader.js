/**
 * Google Sheets dynamic events loader for RSET IEDC Website
 * Fetches events data from Google Sheets and renders them on events.html.
 * Falls back gracefully to the static HTML events if the sheet is
 * unavailable, private, or returns no valid rows.
 */

(function ($) {
    "use strict";

    var SHEET_ID = '1rZUeS3HQUzrKHRNR1nplt5cdkHWK0h-wDOsjmGSSHp4';
    var GID = '311663456';
    var SHEET_URL = 'https://docs.google.com/spreadsheets/d/' + SHEET_ID +
        '/gviz/tq?tqx=out:json&gid=' + GID;

    // ── Date helpers ────────────────────────────────────────────────────

    /**
     * The Google Visualization API can return dates in two formats:
     *   1. A plain string like "2026-10-12"
     *   2. A JS constructor string "Date(2026,9,12)" (months 0-indexed)
     * This helper normalises both into a real Date object.
     */
    function parseGVizDate(val) {
        if (!val && val !== 0) return null;

        // Handle Google Viz "Date(year, month, day)" notation
        if (typeof val === 'string') {
            var m = val.match(/^Date\((\d+),\s*(\d+),\s*(\d+)\)$/);
            if (m) {
                return new Date(parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10));
            }
        }

        // Otherwise try native parsing
        var d = new Date(val);
        return isNaN(d.getTime()) ? null : d;
    }

    /**
     * Format one or two dates for display.
     *   formatEventDate('2026-10-12', '2026-10-14')  → "Oct 12-14, 2026"
     *   formatEventDate('2026-11-05')                → "Nov 5, 2026"
     */
    function formatEventDate(startRaw, endRaw) {
        var start = parseGVizDate(startRaw);
        if (!start) return String(startRaw || '');

        var opts = { month: 'short', day: 'numeric', year: 'numeric' };

        var end = parseGVizDate(endRaw);
        if (!end || start.getTime() === end.getTime()) {
            return start.toLocaleDateString('en-US', opts);
        }

        var sMonth = start.toLocaleDateString('en-US', { month: 'short' });
        var eMonth = end.toLocaleDateString('en-US', { month: 'short' });

        if (start.getFullYear() === end.getFullYear()) {
            if (sMonth === eMonth) {
                return sMonth + ' ' + start.getDate() + '-' + end.getDate() + ', ' + start.getFullYear();
            }
            return sMonth + ' ' + start.getDate() + ' - ' + eMonth + ' ' + end.getDate() + ', ' + start.getFullYear();
        }
        return start.toLocaleDateString('en-US', opts) + ' - ' + end.toLocaleDateString('en-US', opts);
    }

    // ── Image resolver ──────────────────────────────────────────────────

    /** Map the Cover_Image keyword from the sheet to a local asset or convert URL. */
    function getEventImage(imgVal, title, createdAt) {
        if (title) {
            var cleanTitle = String(title).trim().replace(/[\u2018\u2019]/g, "'");
            if (cleanTitle === "0' Points") {
                return 'img/0_pts.jpeg';
            }
        }
        var str = String(imgVal || '').trim();
        if (str === '1782635297722-d16fc3fb-a142-4b3a-bb0e-efb5f3424090.jpg') {
            return 'img/0_pts.jpeg';
        }
        if (!str) return 'img/upcoming1.jpeg';


        // Handle web URLs and Google Drive links robustly
        var isUrl = /^(https?:\/\/|www\.)/i.test(str) ||
            /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\//.test(str) ||
            str.indexOf('drive.google.com') !== -1 ||
            str.indexOf('docs.google.com') !== -1;

        if (isUrl) {
            var urlStr = str;
            // Prepend https:// if it starts with www. or doesn't have a protocol
            if (!/^https?:\/\//i.test(urlStr)) {
                urlStr = 'https://' + urlStr;
            }

            // Convert Google Drive URLs to direct image URLs
            var driveFileMatch = urlStr.match(/\/file\/d\/([a-zA-Z0-9_-]+)/i);
            if (driveFileMatch && driveFileMatch[1]) {
                return 'https://lh3.googleusercontent.com/d/' + driveFileMatch[1];
            }

            var driveIdMatch = urlStr.match(/[?&]id=([a-zA-Z0-9_-]+)/i);
            if (driveIdMatch && driveIdMatch[1] && urlStr.indexOf('google.com') !== -1) {
                return 'https://lh3.googleusercontent.com/d/' + driveIdMatch[1];
            }

            // Convert Kommodo.ai URLs to direct image URLs using createdAt date
            var kommodoMatch = urlStr.match(/https?:\/\/(?:www\.)?kommodo\.ai\/i\/([a-zA-Z0-9_-]+)/i);
            if (kommodoMatch && kommodoMatch[1]) {
                var kommodoId = kommodoMatch[1];
                var dateObj = new Date();
                if (createdAt) {
                    var parsedDate = new Date(createdAt);
                    if (!isNaN(parsedDate.getTime())) {
                        dateObj = parsedDate;
                    }
                }
                var yyyy = dateObj.getFullYear();
                var mm = String(dateObj.getMonth() + 1).padStart(2, '0');
                var dd = String(dateObj.getDate()).padStart(2, '0');
                return 'https://plain-apac-prod-public.komododecks.com/' + yyyy + mm + '/' + dd + '/' + kommodoId + '/image.jpg';
            }

            return urlStr;
        }

        var lower = str.toLowerCase();
        var map = [
            [['bootcamp', 'weekend'], 'img/gallery1.jpg'],
            [['hackathon', 'idea'], 'img/upcoming1.jpeg'],
            [['prototype', 'design'], 'img/gallery5.jpg'],
            [['investor', 'grant', 'funding'], 'img/s2.jpeg'],
            [['pitch'], 'img/s5.jpeg'],
            [['ai', 'tech', 'emerging'], 'img/s1.png'],
            [['validation'], 'img/s6.PNG'],
            [['fireside', 'founder', 'entrepreneur'], 'img/gallery4.jpg']
        ];

        for (var i = 0; i < map.length; i++) {
            for (var j = 0; j < map[i][0].length; j++) {
                if (lower.indexOf(map[i][0][j]) !== -1) return map[i][1];
            }
        }
        // Assume the value is a filename living in img/
        return 'img/' + str.split('/').pop();
    }

    // ── Helper to safely escape HTML to prevent XSS ─────────────────────
    function esc(str) {
        if (!str) return '';
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(String(str)));
        return div.innerHTML;
    }

    // ── Fetch + parse + render ──────────────────────────────────────────

    function loadEventsFromSheet() {
        $.ajax({
            url: SHEET_URL,
            dataType: 'text',
            timeout: 10000,         // 10 s timeout
            success: function (text) {
                try {
                    processSheetResponse(text);
                } catch (err) {
                    console.error('[events-loader] Parse error:', err);
                    // Keep the static fallback HTML as-is
                }
            },
            error: function (xhr, status, err) {
                console.warn('[events-loader] Could not reach Google Sheet (' + status + '). Keeping static fallback.', err);
                // Static HTML remains untouched — nothing to do
            }
        });
    }

    function processSheetResponse(text) {
        // The response looks like:  /*O_o*/\ngoogle.visualization.Query.setResponse({...});
        var first = text.indexOf('{');
        var last = text.lastIndexOf('}');
        if (first === -1 || last === -1) throw new Error('No JSON object found in response');

        var data = JSON.parse(text.substring(first, last + 1));
        if (!data.table || !data.table.cols || !data.table.rows) {
            throw new Error('Unexpected table structure');
        }

        var cols = data.table.cols;
        var rows = data.table.rows;

        // Build a map  label → column index
        var hdr = {};
        $.each(cols, function (idx, col) {
            if (col && col.label) hdr[col.label.trim()] = idx;
        });

        // Extract a cell value, handling the GViz {v:…, f:…} structure
        function cell(row, label) {
            var i = hdr[label];
            if (i === undefined) return '';
            var c = row.c[i];
            if (!c) return '';
            // For dates the Viz API puts a "Date(…)" string in .v
            // and a human-readable version in .f — prefer .v for parsing.
            return (c.v !== null && c.v !== undefined) ? c.v : '';
        }

        var events = [];
        $.each(rows, function (idx, row) {
            if (!row || !row.c) return;   // skip totally empty rows
            var title = cell(row, 'Event_Title');
            if (!title) return;           // skip rows without a title

            var status = String(cell(row, 'Status') || 'Upcoming');
            if (status.toLowerCase() === 'draft') return;  // skip drafts

            events.push({
                Event_ID: cell(row, 'Event_ID') || ('SHEET_' + idx),
                Event_Title: title,
                Event_Type: cell(row, 'Event_Type') || 'Event',
                Category: cell(row, 'Category') || 'IEDC',
                Short_Description: cell(row, 'Short_Description'),
                Detailed_Description: cell(row, 'Detailed_Description'),
                Start_Date: cell(row, 'Start_Date'),
                End_Date: cell(row, 'End_Date'),
                Event_Duration: cell(row, 'Event_Duration'),
                Start_Time: cell(row, 'Start_Time'),
                End_Time: cell(row, 'End_Time'),
                Venue: cell(row, 'Venue') || 'TBD',
                Organizer: cell(row, 'Organizer'),
                Target_Audience: cell(row, 'Target_Audience'),
                Registration_Deadline: cell(row, 'Registration_Deadline'),
                Capacity: cell(row, 'Capacity'),
                Status: status,
                Cover_Image: cell(row, 'Cover_Image'),
                Learning_Outcomes: cell(row, 'Learning_Outcomes'),
                Mentor_Details: cell(row, 'Mentor_Details'),
                Key_Topics: cell(row, 'Key_Topics'),
                Contact_Name: cell(row, 'Contact_Name') || cell(row, 'Contact_Person'),
                Contact_Email: cell(row, 'Contact_Email'),
                Contact_Phone: cell(row, 'Contact_Phone'),
                Tags: cell(row, 'Tags'),
                Reg_Form: cell(row, 'Reg_Form'),
                Created_At: cell(row, 'Created_At') || cell(row, 'Created_Date')
            });
        });

        if (events.length === 0) {
            console.warn('[events-loader] No displayable events in sheet. Keeping static HTML.');
            return;
        }

        renderEvents(events);
    }

    // ── DOM rendering ───────────────────────────────────────────────────

    function renderEvents(events) {
        var $openContainer = $('#open-events-container');
        var $closedContainer = $('#closed-events-container');
        var $dynamicTabs = $('#events-dynamic-tabs');
        var $fallbackCards = $('#events-container');
        var $modals = $('#modals-container');
        if (!$openContainer.length || !$closedContainer.length || !$modals.length) return;

        var openCardsHtml = '';
        var closedCardsHtml = '';
        var modalsHtml = '';

        var openCount = 0;
        var closedCount = 0;

        $.each(events, function (index, ev) {
            var dateStr = formatEventDate(ev.Start_Date, ev.End_Date);
            var imgPath = getEventImage(ev.Cover_Image, ev.Event_Title, ev.Created_At);
            var statusLower = ev.Status.toLowerCase();
            var isOpen = (statusLower === 'upcoming' || statusLower === 'active');

            var cardIndex = isOpen ? openCount : closedCount;
            var delay = ((cardIndex % 3) * 0.2 + 0.1).toFixed(1) + 's';
            var modalId = 'sheetModal_' + esc(ev.Event_ID);
            var btnLabel = isOpen ? 'Register Now' : 'Read More';

            if (isOpen) {
                openCount++;
            } else {
                closedCount++;
            }

            // ──── Card ────
            var cardHtml =
                '<div class="col-lg-4 col-md-6 wow fadeInUp" data-wow-delay="' + delay + '">' +
                '<div class="causes-item d-flex flex-column bg-light border-top border-5 border-primary rounded-top overflow-hidden h-100 shadow-sm">' +
                '<div class="p-4 pt-3 flex-grow-1">' +
                '<div class="d-inline-block bg-secondary text-primary rounded-pill px-3 py-1 mb-3 small fw-bold">' +
                esc(ev.Event_Type) +
                '</div>' +
                '<h5 class="mb-3">' + esc(ev.Event_Title) + '</h5>' +
                '<p class="text-muted mb-3">' + esc(ev.Short_Description) + '</p>' +
                '<div class="border-top pt-2 mt-auto">' +
                '<small class="text-body d-block mb-1">' +
                '<i class="fa fa-calendar-alt text-primary me-2"></i>' + esc(dateStr) +
                '</small>' +
                '<small class="text-body d-block">' +
                '<i class="fa fa-map-marker-alt text-primary me-2"></i>' + esc(ev.Venue) +
                '</small>' +
                '</div>' +
                '</div>' +
                '<div class="position-relative mt-auto">' +
                '<img class="img-fluid w-100" src="' + imgPath + '" alt="' + esc(ev.Event_Title) + '" style="height:220px;object-fit:cover;">' +
                '<div class="causes-overlay">' +
                '<a class="btn btn-outline-primary" href="javascript:void(0)" data-bs-toggle="modal" data-bs-target="#' + modalId + '">' +
                btnLabel +
                '<div class="d-inline-flex btn-sm-square bg-primary text-white rounded-circle ms-2">' +
                '<i class="fa fa-arrow-right"></i>' +
                '</div>' +
                '</a>' +
                '</div>' +
                '</div>' +
                '</div>' +
                '</div>';

            if (isOpen) {
                openCardsHtml += cardHtml;
            } else {
                closedCardsHtml += cardHtml;
            }

            // ──── Modal ────
            var modalBody =
                '<div class="row">' +
                '<div class="col-md-6">' +
                '<img class="img-fluid rounded mb-3 mb-md-0" src="' + imgPath + '" alt="' + esc(ev.Event_Title) + '">' +
                '</div>' +
                '<div class="col-md-6">' +

                // Badges
                '<div class="mb-3">' +
                '<span class="badge bg-secondary text-primary rounded-pill px-3 py-1 fw-bold">' + esc(ev.Event_Type) + '</span>' +
                (ev.Category ? ' <span class="badge bg-primary text-white rounded-pill px-3 py-1 fw-bold ms-1">' + esc(ev.Category) + '</span>' : '') +
                '</div>' +

                // Description
                '<p class="mb-4">' + esc(ev.Detailed_Description || ev.Short_Description) + '</p>' +

                // Event Details box
                '<div class="bg-light p-3 rounded mb-3">' +
                '<h6 class="border-bottom pb-2 mb-2"><i class="fa fa-info-circle text-primary me-2"></i>Event Details</h6>' +
                '<small class="d-block mb-1"><strong>📅 Date:</strong> ' + esc(dateStr) + '</small>' +
                (ev.Start_Time ? '<small class="d-block mb-1"><strong>🕒 Time:</strong> ' + esc(ev.Start_Time) + (ev.End_Time ? ' – ' + esc(ev.End_Time) : '') + '</small>' : '') +
                '<small class="d-block mb-1"><strong>📍 Venue:</strong> ' + esc(ev.Venue) + '</small>' +
                (ev.Organizer ? '<small class="d-block mb-1"><strong>🏢 Organizer:</strong> ' + esc(ev.Organizer) + '</small>' : '') +
                (ev.Target_Audience ? '<small class="d-block mb-1"><strong>👥 Audience:</strong> ' + esc(ev.Target_Audience) + '</small>' : '') +
                (ev.Capacity ? '<small class="d-block mb-1"><strong>💺 Capacity:</strong> ' + esc(String(ev.Capacity)) + ' seats</small>' : '') +
                '</div>';

            // Content & Mentors (only if data exists)
            if (ev.Mentor_Details || ev.Key_Topics || ev.Learning_Outcomes) {
                modalBody +=
                    '<div class="bg-light p-3 rounded mb-3">' +
                    '<h6 class="border-bottom pb-2 mb-2"><i class="fa fa-chalkboard-teacher text-primary me-2"></i>Content &amp; Mentors</h6>' +
                    (ev.Mentor_Details ? '<small class="d-block mb-1"><strong>Mentor(s):</strong> ' + esc(ev.Mentor_Details) + '</small>' : '') +
                    (ev.Key_Topics ? '<small class="d-block mb-1"><strong>Key Topics:</strong> ' + esc(ev.Key_Topics) + '</small>' : '') +
                    (ev.Learning_Outcomes ? '<small class="d-block mb-1"><strong>Learning Outcomes:</strong> ' + esc(ev.Learning_Outcomes) + '</small>' : '') +
                    '</div>';
            }

            // Registration & Contact (only if data exists)
            if (ev.Registration_Deadline || ev.Contact_Name || ev.Contact_Email || ev.Contact_Phone) {
                modalBody +=
                    '<div class="bg-light p-3 rounded mb-3">' +
                    '<h6 class="border-bottom pb-2 mb-2"><i class="fa fa-address-book text-primary me-2"></i>Registration &amp; Contact</h6>' +
                    (ev.Registration_Deadline ? '<small class="d-block mb-1 text-danger"><strong>⏰ Deadline:</strong> ' + esc(formatEventDate(ev.Registration_Deadline)) + '</small>' : '') +
                    (ev.Contact_Name ? '<small class="d-block mb-1"><strong>👤 Contact:</strong> ' + esc(ev.Contact_Name) + '</small>' : '') +
                    (ev.Contact_Phone ? '<small class="d-block mb-1"><strong>📞 Phone:</strong> <a href="tel:' + esc(ev.Contact_Phone) + '">' + esc(ev.Contact_Phone) + '</a></small>' : '') +
                    (ev.Contact_Email ? '<small class="d-block mb-1"><strong>✉️ Email:</strong> <a href="mailto:' + esc(ev.Contact_Email) + '">' + esc(ev.Contact_Email) + '</a></small>' : '') +
                    '</div>';
            }

            // CTA button — link directly to Google Form URL
            if (isOpen && ev.Reg_Form) {
                modalBody += '<a href="' + esc(ev.Reg_Form) + '" target="_blank" class="btn btn-primary w-100 mt-2 reg-now-btn">' +
                    '<i class="fa fa-edit me-2"></i>Register Now</a>';
            } else if (isOpen) {
                modalBody += '<button class="btn btn-secondary w-100 mt-2" disabled>Registration Link Unavailable</button>';
            } else {
                modalBody += '<button class="btn btn-secondary w-100 mt-2" disabled>Registration Closed</button>';
            }

            modalBody +=
                '</div>' +   // close col-md-6
                '</div>';      // close row

            modalsHtml +=
                '<div class="modal fade" id="' + modalId + '" tabindex="-1" aria-labelledby="' + modalId + 'Label" aria-hidden="true">' +
                '<div class="modal-dialog modal-lg">' +
                '<div class="modal-content">' +
                '<div class="modal-header">' +
                '<h3 class="modal-title" id="' + modalId + 'Label">' + esc(ev.Event_Title) + '</h3>' +
                '<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>' +
                '</div>' +
                '<div class="modal-body">' + modalBody + '</div>' +
                '</div>' +
                '</div>' +
                '</div>';
        });

        // Set empty states if needed
        if (openCount === 0) {
            openCardsHtml = '<div class="col-12 text-center py-5"><h5 class="text-muted">No open events at the moment. Stay tuned!</h5></div>';
        }
        if (closedCount === 0) {
            closedCardsHtml = '<div class="col-12 text-center py-5"><h5 class="text-muted">No past events to display.</h5></div>';
        }

        // Replace the containers
        $openContainer.html(openCardsHtml);
        $closedContainer.html(closedCardsHtml);
        $modals.html(modalsHtml);

        // Hide fallback static cards and show dynamic tabbed container
        $fallbackCards.addClass('d-none');
        $dynamicTabs.removeClass('d-none');

        // Re-init WOW.js so the freshly injected cards still animate
        if (typeof WOW !== 'undefined') {
            new WOW({ live: false }).init();
        }
    }

    // ── Bootstrap ───────────────────────────────────────────────────────

    $(document).ready(function () {
        loadEventsFromSheet();
    });

})(jQuery);
