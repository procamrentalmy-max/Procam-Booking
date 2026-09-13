export const en = {
  common: {
    continue: "Continue",
    back: "Back",
    next: "Next",
    done: "Done",
    cancel: "Cancel",
    starting: "Starting…",
    checking: "Checking…",
    submitting: "Submitting…",
    processing: "Processing…",
    somethingWentWrong: "Something went wrong.",
    termsAndConditions: "Terms & Conditions",
    bookingNotFound: "Booking not found.",
  },
  languageToggle: {
    label: "Language",
  },
  home: {
    title: "ProCam",
    subtitle: "Scan the QR code at your hotel reception to rent an action camera or underwater phone housing.",
    usp: "🏨 Delivered to your hotel — pick up and drop off right where you're staying, no shop visit needed.",
  },
  landing: {
    brand: "ProCam",
    equipmentRentalAt: (partnerName: string) => `Equipment rental at ${partnerName}`,
    noEquipment: "No equipment is currently set up at this property.",
    usp: "🏨 Delivered to your hotel — pick up and drop off right here, no shop visit needed.",
  },
  booking: {
    stepTitles: {
      locations: "Pickup & Dropoff",
      contact: "Your Details",
      phone: "Check Your Phone",
      verify: "Verify Your Identity",
      confirm: "Confirm Booking",
      booked: "Booking Confirmed",
    },
    table: { duration: "Duration", price: "Price" },
    mode: { daytime: "Daytime", overnight: "Overnight", multiday: "Multi-Day" },
    hint: {
      overnight: "Pick up at 10pm, return by 8am — bookings need at least 2 hours of notice.",
      daytime:
        "Pick a date, then a start time and an end time from the timetable — bookings need at least 2 hours of notice. If your exact slot isn't free, we'll offer the next available one.",
      multiday:
        "Pick a date and start time, then choose how many days you need — bookings need at least 2 hours of notice.",
    },
    timetable: {
      tapStart: "Tap a start time",
      tapEnd: "Now tap an end time",
      tapRestart: "Tap any time to start over",
      chooseDuration: "Choose a duration",
    },
    locations: {
      hint: "Pick up and drop off at the same spot, or choose different locations for a one-way rental.",
      pickup: "Pickup",
      dropoff: "Dropoff",
    },
    contact: {
      namePlaceholder: "Full name",
      phonePlaceholder: "Phone number, with country code, e.g. +60123456789",
      emailPlaceholder: "Email",
    },
    phone: {
      compatibilityHint: (productName: string) =>
        `${productName} works with your own phone — let's check it's compatible before you continue.`,
      manufacturerPlaceholder: "Manufacturer, e.g. Apple",
      modelPlaceholder: "Model, e.g. iPhone 16 Pro Max",
      variantPlaceholder: "Variant (optional)",
      compatible: "Your phone is compatible.",
      incompatible: (productName: string) =>
        `We can't confirm this phone works with ${productName}. Please try a different phone — we can't book this rental with an unconfirmed fit.`,
      checkCompatibility: "Check Compatibility",
    },
    verify: {
      hint: "Verify your identity to continue — you'll photograph your ID and take a quick selfie.",
      start: "Start Verification",
      skipDev: "Skip Verification (dev only)",
    },
    confirm: {
      requestedPickup: (time: string) => `Requested pickup: ${time}`,
      pickup: (name: string) => `Pickup: ${name}`,
      dropoffSuffix: (name: string) => ` — Dropoff: ${name}`,
      rentalFee: (price: number | string) => `Rental fee: RM${price}`,
      deposit: (deposit: number | string) => `Refundable security deposit: RM${deposit}`,
      agreementPrefix:
        "I agree to the ProCam rental terms above, including responsibility for the equipment and accessories until returned and inspected, and to the full ",
      agreementSuffix: ".",
      continueToPayment: "Continue to Payment",
      reserving: "Reserving…",
    },
    booked: {
      notAvailable: "Your requested hour wasn't available, so we've booked you the next open slot instead:",
      until: (time: string) => `until ${time}`,
    },
    errors: {
      selectPackage: "Select a rental package.",
      minNotice: (hours: number) =>
        `Bookings need at least ${hours} hour${hours === 1 ? "" : "s"} of notice — please choose a later time.`,
      selectLocations: "Select a pickup and a dropoff location.",
      verificationNotApproved: "We couldn't approve your verification. Please try again.",
      verificationFailed: "Verification failed. Please try again.",
    },
  },
  bookingServer: {
    couldNotStartBooking: "Could not start your booking. Please try again.",
    couldNotStartVerification: "Could not start verification. Please try again.",
    verificationNotFound: "Verification not found. Please start again.",
    verificationSessionMissing: "Verification session missing. Please start again.",
    devNotAvailable: "Not available.",
    verificationRequired: "Identity verification is required before booking.",
    invalidDateTime: "Please choose a valid date and time.",
    noAssetAvailable: "No equipment is available for that time and location.",
  },
  dashboard: {
    bookingLabel: (humanId: string) => `Booking ${humanId}`,
    statusLabels: {
      PENDING_PAYMENT: "Pending Payment",
      READY_FOR_PICKUP: "Ready For Pickup",
      ACTIVE: "Active",
      RETURN_STARTED: "Return Started",
      AWAITING_INSPECTION: "Awaiting Inspection",
      INSPECTION: "Inspection",
      DAMAGE_REVIEW: "Damage Review",
      COMPLETED: "Completed",
      CANCELLED: "Cancelled",
      EXPIRED: "Expired",
      CONFIRMED: "Confirmed",
    } as Record<string, string>,
    confirmedAt: (time: string) => `You're all set. Come back at ${time} to pick up your equipment at the locker.`,
    confirmedNow: "You're all set. Show this page at the locker to pick up your equipment.",
    statusMessages: {
      PENDING_PAYMENT: "Payment hasn't been completed yet.",
      READY_FOR_PICKUP: "Your equipment is ready for pickup at the locker.",
      ACTIVE: "Your rental is in progress. Enjoy!",
      RETURN_STARTED: "Please place your equipment back into the locker now.",
      AWAITING_INSPECTION: "Thanks for returning your equipment. Your deposit is held until ProCam staff inspect it.",
      INSPECTION: "Your equipment is being inspected now.",
      DAMAGE_REVIEW: "An issue was found during inspection. Our team will be in touch about your deposit.",
      COMPLETED: "This rental is complete. Thanks for renting with ProCam!",
      CANCELLED: "This booking was cancelled.",
      EXPIRED: "This booking expired before payment was completed.",
    } as Record<string, string>,
    completePayment: "Complete Payment",
    startPickupCheck: "Start Pickup Check",
    viewInstructions: "View Instructions",
    beginReturn: "Begin Return",
    row: {
      pickup: "Pickup",
      dropoff: "Dropoff",
      package: "Package",
      equipment: "Equipment",
      start: "Start",
      returnBy: "Return by",
    },
  },
  rating: {
    thanks: "Thanks for the feedback!",
    question: "How was your rental?",
    rateAria: (value: number) => `Rate ${value} out of 5 stars`,
  },
  ratingServer: {
    notRateable: "This booking can't be rated yet.",
    alreadyRated: "This booking has already been rated.",
  },
  instructionsCarousel: {
    ofCount: (index: number, total: number) => `${index} of ${total}`,
    instructionsFallback: "Instructions",
    noInstructionsYet: "No instructions yet",
  },
  pay: {
    title: "Pay & Confirm",
    summary: (name: string, price: number | string, deposit: number | string) =>
      `${name} — RM${price} rental fee now. A refundable RM${deposit} deposit is held on the same card right after — you won't be asked to pay again.`,
    unavailable: "Payment isn't available right now.",
    devSkip: "[DEV] Skip Payment — Bypass Stripe",
  },
  paymentForm: {
    payNow: "Pay Now",
    failed: "Payment failed. Please try again.",
  },
  payServer: {
    alreadyPaid: "This booking has already been paid.",
  },
  pickup: {
    stepOf: (step: number, total: number) => `Step ${step} of ${total}`,
    confirmAndStart: "Confirm & Start Rental",
    startRental: "Start Rental",
    startingRental: "Starting rental…",
  },
  pickupServer: {
    notReady: "This booking isn't ready for pickup.",
    noProduct: "Could not determine the rental product for this booking.",
    noCheckConfigured: "No condition check is configured for this product yet.",
    confirmPrefix: "Please confirm: ",
    photoPrefix: "Please add a photo: ",
    saveFailed: "Could not save your condition check. Please try again.",
  },
  returnCheck: {
    stepOf: (step: number, total: number) => `Step ${step} of ${total}`,
    confirmTitle: "Confirm",
    issuesTitle: "Any Issues?",
    lateFeeWarning: (amount: string) =>
      `This return is overdue — a late fee of at least RM${amount} will be deducted from your deposit.`,
    damageQuestion: "Is there any known damage or problem with the equipment or accessories?",
    noIssues: "No issues",
    reportIssue: "Report an issue",
    describePlaceholder: "Describe what happened",
    completeReturn: "Complete Return",
  },
  returnServer: {
    notActive: "This booking isn't active.",
    noProduct: "Could not determine the rental product for this booking.",
    noCheckConfigured: "No return check is configured for this product yet.",
    confirmPrefix: "Please confirm: ",
    photoPrefix: "Please add a photo: ",
    saveFailed: "Could not save your condition check. Please try again.",
  },
  camera: {
    notAvailable: "Camera access isn't available in this browser.",
    cantAccess: "Couldn't access the camera. Check your browser's camera permission and try again.",
    cantProcess: "Couldn't process that photo. Try again.",
    capture: "Capture",
    addAnotherPhoto: "Add another photo",
    tapToTakeAPhoto: "Tap to take a photo",
    tapToTakePhoto: "Tap to take photo",
    retake: "Retake",
    removePhoto: "Remove photo",
  },
  terms: {
    title: "Terms & Conditions",
    lastUpdated: "Last updated 13 September 2026.",
    sections: [
      {
        title: "1. The Service",
        paragraphs: [
          "ProCam rents action cameras and underwater equipment from self-service smart lockers at partner locations in Langkawi, Malaysia. Booking, payment, pickup, and return are all handled through the booking pages linked from each locker's QR code — there is no counter or staff on site.",
        ],
      },
      {
        title: "2. Eligibility",
        paragraphs: [
          "You must be at least 18 years old and able to enter a binding agreement to book a rental. By completing a booking, you confirm this is true.",
        ],
      },
      {
        title: "3. Booking, Pricing & Payment",
        paragraphs: [
          "Prices shown at booking are per the selected rental duration and are charged in Malaysian Ringgit (MYR). Bookings require at least 2 hours' notice. The rental fee is charged first; a separate, refundable security deposit is then held on the same payment method immediately after — you will not be asked to pay twice. An unpaid booking that is not completed within a short window is automatically cancelled and the equipment released back to other customers.",
        ],
      },
      {
        title: "4. Identity Verification",
        paragraphs: [
          "To book, you must complete an identity verification step (a government ID and a live selfie, processed by our verification provider). This confirms you are a real person able to be held responsible for the equipment for the rental period. We do not manually review or store copies of your ID ourselves — see {privacyLink} below for how this data is handled.",
        ],
      },
      {
        title: "5. Pickup, Use & Return",
        paragraphs: [
          "You are responsible for the equipment and everything in its kit (cables, cases, accessories) from the moment you open the locker compartment until ProCam staff have inspected and accepted its return. Use the equipment only as intended and only for the duration booked. Each product page shows specific handling instructions (e.g. sealing checks for underwater housings) — following them is your responsibility, not something ProCam can verify remotely.",
          "Return the equipment to a self-service locker by your booked end time. Returning late incurs the late fee shown on your rental package at the time of booking, charged per hour or part-hour late.",
        ],
      },
      {
        title: "6. Security Deposit, Damage & Loss",
        paragraphs: [
          "The security deposit is refundable and is released after staff inspect the returned equipment. If the equipment is returned damaged, missing parts, or not returned at all, ProCam may capture some or all of the deposit to cover the cost of repair, replacement, or loss. If that cost exceeds the deposit amount, you remain responsible for the difference and may be charged separately.",
          "For underwater housings specifically: the deposit and any damage assessment cover the ProCam-owned housing and kit only. ProCam is not responsible for damage to your own phone or device, including water damage, if a housing seal failed — following the guided seal-check step before entering water is your responsibility.",
        ],
      },
      {
        title: "7. Cancellations & Changes",
        paragraphs: [
          "To cancel or reschedule a confirmed booking, contact ProCam support through your booking page as soon as possible. Refund eligibility depends on how much notice is given and whether the equipment has already been prepared for your pickup.",
        ],
      },
      {
        title: "8. Prohibited Use",
        paragraphs: [
          "You may not sublet, resell, or lend the equipment to anyone else, attempt your own repairs, remove or tamper with any tracking or asset labels, or use the equipment for any unlawful purpose. Doing so voids any deposit refund and may result in additional charges.",
        ],
      },
      {
        title: "9. Limitation of Liability",
        paragraphs: [
          "ProCam provides the equipment as-is and is not liable for indirect, incidental, or consequential damages arising from its use — including lost content, missed moments, or third-party claims — beyond the rental fee and deposit actually paid for that booking. Nothing in these terms limits liability that cannot be limited under Malaysian law.",
        ],
      },
      {
        title: "10. Privacy",
        paragraphs: [
          "We collect your name, phone number, and email to create and manage your booking, and process an ID document and selfie through our identity verification provider to confirm you're eligible to book. Payment details are handled directly by our payment processor — ProCam never sees or stores your card number. This information is used only for booking, verification, support, and legal/compliance purposes, and is handled in line with Malaysia's Personal Data Protection Act (PDPA).",
        ],
      },
      {
        title: "11. Governing Law",
        paragraphs: [
          "These terms are governed by the laws of Malaysia. Any dispute arising from a booking is subject to the exclusive jurisdiction of the Malaysian courts.",
        ],
      },
      {
        title: "12. Contact",
        paragraphs: ["For questions about these terms, or about an active or past booking, message ProCam support from your booking page."],
      },
    ],
    privacyLinkText: "Privacy",
  },
};

export type Dictionary = typeof en;
