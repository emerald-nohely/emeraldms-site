// How long to wait after scrollIntoView() before starting the spotlight
// flash, so it doesn't fire mid-scroll.
const SCROLL_SETTLE_DELAY_MS = 500;
// How long the footer contact spotlight stays dimmed/flashing.
const SPOTLIGHT_DURATION_MS = 2000;
// How long the "opening your email client" status message shows before the
// modal auto-closes.
const MODAL_CLOSE_DELAY_MS = 1800;

document.addEventListener("DOMContentLoaded", () => {
  const menuBtn = document.querySelector(".menu-btn");
  const nav = document.querySelector("nav");

  menuBtn.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("open");
    menuBtn.setAttribute("aria-expanded", isOpen);
  });

  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      nav.classList.remove("open");
      menuBtn.setAttribute("aria-expanded", "false");
    });
  });

  // Highlight the nav link matching the section currently in view
  const sections = document.querySelectorAll("main section[id]");
  const navLinks = document.querySelectorAll("nav a:not(.nav-cta)");

  const setActiveLink = (id) => {
    navLinks.forEach((link) => {
      link.classList.toggle("active", link.getAttribute("href") === `#${id}`);
    });
  };

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) setActiveLink(entry.target.id);
      });
    },
    { rootMargin: "-45% 0px -50% 0px" }
  );

  sections.forEach((section) => observer.observe(section));

  // Service cards: clicking anywhere outside an open card closes it.
  // Track open cards via the native "toggle" event instead of querying the
  // DOM on every click.
  const openSvcCards = new Set();
  document.querySelectorAll(".svc-card").forEach((card) => {
    card.addEventListener("toggle", () => {
      if (card.open) openSvcCards.add(card);
      else openSvcCards.delete(card);
    });
  });
  document.addEventListener("click", (event) => {
    openSvcCards.forEach((card) => {
      if (!card.contains(event.target)) card.open = false;
    });
  });

  // "Contact Us" nav link: scroll to the footer contact column and spotlight it.
  const contactNavLink = document.querySelector(".js-highlight-contact");
  const footerContact = document.getElementById("footer-contact");
  if (contactNavLink && footerContact) {
    const dimOverlay = document.createElement("div");
    dimOverlay.className = "page-dim-overlay";
    document.body.appendChild(dimOverlay);
    let spotlightTimeout = null;

    contactNavLink.addEventListener("click", (event) => {
      event.preventDefault();
      footerContact.scrollIntoView({ behavior: "smooth", block: "center" });

      clearTimeout(spotlightTimeout);
      dimOverlay.classList.remove("active");
      footerContact.classList.remove("spotlight-target");

      spotlightTimeout = setTimeout(() => {
        dimOverlay.classList.add("active");
        // Force reflow so the flash animation restarts if triggered again.
        void footerContact.offsetWidth;
        footerContact.classList.add("spotlight-target");

        spotlightTimeout = setTimeout(() => {
          dimOverlay.classList.remove("active");
          footerContact.classList.remove("spotlight-target");
        }, SPOTLIGHT_DURATION_MS);
      }, SCROLL_SETTLE_DELAY_MS);
    });
  }

  // Consultation request modal
  const modal = document.getElementById("consultation-modal");
  const modalForm = document.getElementById("consultation-form");
  const modalStatus = document.getElementById("modal-status");
  const openTriggers = document.querySelectorAll(".js-open-modal");
  const closeBtn = modal.querySelector(".modal-close");
  let lastFocused = null;

  const datePicker = window.flatpickr
    ? window.flatpickr("#consult-date", {
        dateFormat: "Y-m-d",
        altInput: true,
        altFormat: "F j, Y",
        minDate: "today",
      })
    : null;
  modalForm.addEventListener("reset", () => {
    if (datePicker) setTimeout(() => datePicker.clear(), 0);
  });

  // Populate the preferred-time dropdown with 15-minute slots, 7 AM-7 PM.
  const timeSelect = document.getElementById("consult-time");
  for (let minutes = 7 * 60; minutes <= 19 * 60; minutes += 15) {
    const hour24 = Math.floor(minutes / 60);
    const minute = minutes % 60;
    const period = hour24 < 12 ? "AM" : "PM";
    const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
    const value = `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    const option = document.createElement("option");
    option.value = value;
    option.textContent = `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
    timeSelect.appendChild(option);
  }

  // Format as (XXX) XXX-XXXX while typing.
  const phoneInput = document.getElementById("consult-phone");
  phoneInput.addEventListener("input", () => {
    const digits = phoneInput.value.replace(/\D/g, "").slice(0, 10);
    let formatted = digits;
    if (digits.length > 6) {
      formatted = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    } else if (digits.length > 3) {
      formatted = `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    } else if (digits.length > 0) {
      formatted = `(${digits}`;
    }
    phoneInput.value = formatted;
  });

  const openModal = (event) => {
    event.preventDefault();
    lastFocused = document.activeElement;
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    modalForm.querySelector('input[name="businessName"]').focus();
  };

  const closeModal = () => {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    if (lastFocused) lastFocused.focus();
  };

  openTriggers.forEach((trigger) => trigger.addEventListener("click", openModal));
  closeBtn.addEventListener("click", closeModal);
  // Only close on a genuine backdrop click - not a text-selection drag that
  // starts inside the modal and ends (mouseup) outside it, which would
  // otherwise fire a click event targeting the overlay.
  let modalMouseDownOnOverlay = false;
  modal.addEventListener("mousedown", (event) => {
    modalMouseDownOnOverlay = event.target === modal;
  });
  modal.addEventListener("click", (event) => {
    if (event.target === modal && modalMouseDownOnOverlay) closeModal();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modal.classList.contains("open")) closeModal();
  });

  modalForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(modalForm);
    const payload = {};
    for (const [key, value] of data.entries()) {
      if (key in payload) {
        payload[key] = Array.isArray(payload[key]) ? [...payload[key], value] : [payload[key], value];
      } else {
        payload[key] = value;
      }
    }

    const submitBtn = modalForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    modalStatus.hidden = false;
    modalStatus.textContent = "Sending your request…";

    try {
      const response = await fetch("/api/schedule-consultation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error("Request failed");

      modalStatus.textContent = "Thanks! We'll be in touch shortly.";
      setTimeout(() => {
        closeModal();
        modalForm.reset();
        modalStatus.hidden = true;
        submitBtn.disabled = false;
      }, MODAL_CLOSE_DELAY_MS);
    } catch (err) {
      modalStatus.textContent =
        "Something went wrong. Please email us directly at info@emeraldmanagementsolutions.org.";
      submitBtn.disabled = false;
    }
  });
});
