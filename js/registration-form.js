/**
 * Custom Registration Form Handler for RSET IEDC Website
 * 
 * Submits form data to:
 * 1. Google Forms (via hidden iframe for CORS safety)
 * 2. Google Sheets (via Apps Script Web App)
 */

(function ($) {
    "use strict";

    // ── Configuration ────────────────────────────────────────────────────
    var GOOGLE_FORM_ACTION = 'https://docs.google.com/forms/d/e/1FAIpQLSffRY69reQ_7RyuyXgp9vik4LFTQV6db9tW3U_LBUhWYGGzjw/formResponse';

    // Google Sheets Apps Script Web App URL
    // Replace this with your deployed Apps Script URL
    var APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx_AyO0i4X7fRN9MoAE6cvem2JgD7TtjJKwzCiHGaxYls6vOU5BvaC6SaupSqYgx0s/exec';

    // Google Forms entry IDs
    var ENTRY_IDS = {
        name: 'entry.2092238618',
        email: 'entry.1556369182',
        organization: 'entry.479301265',
        days: 'entry.1753222212',
        dietary: 'entry.588393791',
        acknowledge: 'entry.2109138769'
    };

    // ── State ────────────────────────────────────────────────────────────
    var currentEventTitle = '';
    var isSubmitting = false;

    // ── Open Registration Form ───────────────────────────────────────────
    window.openRegistrationForm = function (eventTitle) {
        currentEventTitle = eventTitle || 'Event';

        // Update modal header with event name
        $('#regEventName').text(currentEventTitle);

        // Reset form state
        resetForm();

        // Show form, hide success
        $('#regFormContent').show();
        $('#regSuccessState').hide();
        $('#regErrorMsg').hide();

        // Open modal
        var modal = new bootstrap.Modal(document.getElementById('registrationFormModal'));
        modal.show();
    };

    // ── Form Reset ───────────────────────────────────────────────────────
    function resetForm() {
        var $form = $('#registrationForm');
        $form[0].reset();
        $form.find('.is-invalid').removeClass('is-invalid');
        $form.find('.invalid-feedback').hide();
        $('#regSubmitBtn').prop('disabled', false).html('<i class="fa fa-paper-plane me-2"></i>Submit Registration');
        isSubmitting = false;
    }

    // ── Validation ───────────────────────────────────────────────────────
    function validateForm() {
        var isValid = true;

        // Name
        var $name = $('#regName');
        if (!$name.val().trim()) {
            $name.addClass('is-invalid');
            isValid = false;
        } else {
            $name.removeClass('is-invalid');
        }

        // Email
        var $email = $('#regEmail');
        var emailVal = $email.val().trim();
        var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailVal || !emailRegex.test(emailVal)) {
            $email.addClass('is-invalid');
            isValid = false;
        } else {
            $email.removeClass('is-invalid');
        }

        // Organization
        var $org = $('#regOrganization');
        if (!$org.val().trim()) {
            $org.addClass('is-invalid');
            isValid = false;
        } else {
            $org.removeClass('is-invalid');
        }

        // Days attending (at least one checked)
        var daysChecked = $('input[name="regDays"]:checked').length > 0;
        var $daysGroup = $('#regDaysGroup');
        if (!daysChecked) {
            $daysGroup.addClass('is-invalid');
            isValid = false;
        } else {
            $daysGroup.removeClass('is-invalid');
        }

        // Dietary
        var $dietary = $('#regDietary');
        if (!$dietary.val()) {
            $dietary.addClass('is-invalid');
            isValid = false;
        } else {
            $dietary.removeClass('is-invalid');
        }

        // Acknowledge
        var $ack = $('#regAcknowledge');
        if (!$ack.is(':checked')) {
            $ack.closest('.reg-form-group').find('.reg-acknowledge-group').addClass('is-invalid');
            $ack.closest('.reg-form-group').find('.invalid-feedback').show();
            isValid = false;
        } else {
            $ack.closest('.reg-form-group').find('.reg-acknowledge-group').removeClass('is-invalid');
        }

        return isValid;
    }

    // ── Collect Form Data ────────────────────────────────────────────────
    function collectFormData() {
        var name = $('#regName').val().trim();
        var email = $('#regEmail').val().trim();
        var organization = $('#regOrganization').val().trim();
        var dietary = $('#regDietary').val();
        var acknowledge = $('#regAcknowledge').is(':checked') ? 'Yes' : '';

        var days = [];
        $('input[name="regDays"]:checked').each(function () {
            days.push($(this).val());
        });

        return {
            name: name,
            email: email,
            organization: organization,
            days: days,
            dietary: dietary,
            acknowledge: acknowledge,
            eventTitle: currentEventTitle,
            timestamp: new Date().toISOString()
        };
    }

    // ── Submit to Google Forms (via hidden iframe) ────────────────────────
    function submitToGoogleForm(data) {
        // Create a hidden form that targets the hidden iframe
        var $hiddenForm = $('<form>', {
            action: GOOGLE_FORM_ACTION,
            method: 'POST',
            target: 'regHiddenIframe',
            css: { display: 'none' }
        });

        // Add fields
        $hiddenForm.append($('<input>', { type: 'hidden', name: ENTRY_IDS.name, value: data.name }));
        $hiddenForm.append($('<input>', { type: 'hidden', name: ENTRY_IDS.email, value: data.email }));
        $hiddenForm.append($('<input>', { type: 'hidden', name: ENTRY_IDS.organization, value: data.organization }));

        // Checkboxes need multiple inputs with the same name
        data.days.forEach(function (day) {
            $hiddenForm.append($('<input>', { type: 'hidden', name: ENTRY_IDS.days, value: day }));
        });

        $hiddenForm.append($('<input>', { type: 'hidden', name: ENTRY_IDS.dietary, value: data.dietary }));

        if (data.acknowledge) {
            $hiddenForm.append($('<input>', { type: 'hidden', name: ENTRY_IDS.acknowledge, value: data.acknowledge }));
        }

        $('body').append($hiddenForm);
        $hiddenForm.submit();

        // Cleanup after a short delay
        setTimeout(function () {
            $hiddenForm.remove();
        }, 2000);
    }

    // ── Submit to Google Sheets via Apps Script ───────────────────────────
    function submitToGoogleSheet(data) {
        var payload = {
            name: data.name,
            email: data.email,
            organization: data.organization,
            days: data.days.join(', '),
            dietary: data.dietary,
            acknowledge: data.acknowledge,
            eventTitle: data.eventTitle,
            timestamp: data.timestamp
        };

        // Only send if Apps Script URL is configured
        if (APPS_SCRIPT_URL.indexOf('REPLACE_WITH') !== -1) {
            console.warn('[registration-form] Apps Script URL not configured. Skipping sheet submission.');
            return;
        }

        $.ajax({
            url: APPS_SCRIPT_URL,
            method: 'POST',
            data: JSON.stringify(payload),
            contentType: 'application/json',
            timeout: 15000,
            success: function () {
                console.log('[registration-form] Sheet submission successful.');
            },
            error: function (xhr, status, err) {
                console.warn('[registration-form] Sheet submission failed:', status, err);
            }
        });
    }

    // ── Form Submit Handler ──────────────────────────────────────────────
    function handleSubmit(e) {
        e.preventDefault();

        if (isSubmitting) return;

        if (!validateForm()) return;

        isSubmitting = true;
        var $btn = $('#regSubmitBtn');
        $btn.prop('disabled', true).html(
            '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>Submitting...'
        );
        $('#regErrorMsg').hide();

        var data = collectFormData();

        try {
            // Submit to Google Forms
            submitToGoogleForm(data);

            // Submit to Google Sheets
            submitToGoogleSheet(data);

            // Show success after a brief delay (to let iframe submit)
            setTimeout(function () {
                showSuccess();
            }, 1200);

        } catch (err) {
            console.error('[registration-form] Submit error:', err);
            showError('Something went wrong. Please try again.');
        }
    }

    // ── Success/Error States ─────────────────────────────────────────────
    function showSuccess() {
        $('#regFormContent').fadeOut(200, function () {
            $('#regSuccessState').fadeIn(300);
        });
        isSubmitting = false;
    }

    function showError(msg) {
        $('#regErrorMsg').text(msg).fadeIn(300);
        var $btn = $('#regSubmitBtn');
        $btn.prop('disabled', false).html('<i class="fa fa-paper-plane me-2"></i>Submit Registration');
        isSubmitting = false;
    }

    // ── Real-time validation (remove error on input) ─────────────────────
    function bindRealtimeValidation() {
        $('#regName, #regEmail, #regOrganization').on('input', function () {
            $(this).removeClass('is-invalid');
        });

        $('#regDietary').on('change', function () {
            $(this).removeClass('is-invalid');
        });

        $('input[name="regDays"]').on('change', function () {
            $('#regDaysGroup').removeClass('is-invalid');
        });

        $('#regAcknowledge').on('change', function () {
            if ($(this).is(':checked')) {
                $(this).closest('.reg-form-group').find('.reg-acknowledge-group').removeClass('is-invalid');
                $(this).closest('.reg-form-group').find('.invalid-feedback').hide();
            }
        });
    }

    // ── Initialize ───────────────────────────────────────────────────────
    $(document).ready(function () {
        // Bind form submit
        $('#registrationForm').on('submit', handleSubmit);

        // Bind real-time validation
        bindRealtimeValidation();

        // Close success button
        $('#regCloseSuccess').on('click', function () {
            var modal = bootstrap.Modal.getInstance(document.getElementById('registrationFormModal'));
            if (modal) modal.hide();
        });

        // Reset form when modal is closed
        $('#registrationFormModal').on('hidden.bs.modal', function () {
            resetForm();
            $('#regFormContent').show();
            $('#regSuccessState').hide();
            $('#regErrorMsg').hide();
        });
    });

})(jQuery);
