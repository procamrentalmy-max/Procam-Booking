import { faqEn, faqMs, faqZh } from "./faq";
import { DEFAULT_LOCALE, type Locale } from "./locale";

/**
 * The Terms, Refund & Cancellation, Privacy and Contact pages, in English, Bahasa Melayu and Chinese. English is the master and
 * the other two are typed against it. A paragraph is `{ p }`, a bullet list is `{ ul }`. Placeholders in {braces} are filled in
 * by the page: {neo2Dep} {neoDep} {rcDep} {goggDep} {holdDays} {grace} {freeHours} {neo2Wind} {neoWind} {business}, and
 * {link:terms} {link:refunds} {link:privacy} {link:contact} {link:faq} become links named by `links`. The FAQ page is in ./faq.ts.
 *
 * The Malay and Chinese were written by Claude, not a lawyer or a native-speaking translator: have both checked before relying on them.
 */
export type LegalBlock = { p: string } | { ul: string[] };
export type LegalSection = { title: string; blocks: LegalBlock[] };
export type LegalPage = { title: string; description: string; sections: LegalSection[] };

export const legalEn = {
  updated: (date: string) => `Last updated ${date}.`,
  navLabel: "Legal pages",
  nav: { terms: "Terms", refunds: "Refunds", privacy: "Privacy", faq: "FAQ", contact: "Contact" },
  links: { terms: "Terms & Conditions", refunds: "Refund & Cancellation Policy", privacy: "Privacy Policy", contact: "Contact page", faq: "FAQ" },
  terms: {
    title: "Terms & Conditions",
    description: "The terms for renting a DJI drone from ProCam Rental: booking, payment, deposit, use, late returns and damage.",
    sections: [
      {
        title: "1. Who we are and what we rent",
        blocks: [
          {
            p: "{business} rents small DJI camera drones in Malaysia: the DJI Neo 2 and the original DJI Neo, with an optional RC-N3 controller or Goggles N3 with Motion 3 controller. You collect and return the drone at one of our partner shops in Kajang or Port Dickson. See our {link:contact} for the shops.",
          },
          { p: "By making a booking you agree to these terms, our {link:refunds} and our {link:privacy}." },
        ],
      },
      {
        title: "2. Who can rent",
        blocks: [
          {
            p: "You must be at least 18 years old and able to make a binding agreement. Before we hold a drone for you, you complete an identity check: a photo of your MyKad or passport and a live selfie, done on your phone through our verification provider. Bring the same photo ID when you collect the drone: the shop staff check it against your booking and can refuse the rental if you cannot show it, if it does not match, or if they have good reason to doubt who you are. In that case the rental fee is refunded in full.",
          },
        ],
      },
      {
        title: "3. Booking, prices and payment",
        blocks: [
          {
            ul: [
              "All prices are in Malaysian Ringgit (MYR). The price you see on the booking page before you pay is the price you pay: the hourly rate for the drone you choose, plus the controller if you add one, plus the battery option.",
              "An online booking is only confirmed once your card payment has gone through. Until then no drone is held for you.",
              "If two people pay for the same last drone, the first payment wins. The other person is refunded in full automatically and is asked to choose another time.",
              "Walk-in rentals at a shop can be paid by card, or the rental fee can be paid in cash at the shop. A card is always needed for the deposit.",
              "Card payments are processed by Stripe. We never see or store your card number.",
            ],
          },
        ],
      },
      {
        title: "4. Security deposit",
        blocks: [
          {
            p: "A refundable deposit is held on your card when your booking is paid: {neo2Dep} for the Neo 2 and {neoDep} for the Neo, plus {rcDep} if you add the RC-N3 controller or {goggDep} if you add the Goggles N3 and Motion 3 controller. The exact deposit is shown before you pay.",
          },
          {
            ul: [
              "The deposit is a hold on your card, not a charge. Nothing is taken from it unless something is damaged, lost or owed.",
              "The hold is released when the drone and controller come back in good condition. Your bank may take a few days to show it as released. A hold lasts at most about {holdDays} days.",
              "The deposit is the most we take for damage to or loss of the equipment. If a repair or replacement costs more than the deposit, we cover the difference. The deposit does not cover late fees, extra batteries or anything else you owe, which are charged separately.",
            ],
          },
        ],
      },
      {
        title: "5. Collecting and returning the drone",
        blocks: [
          {
            ul: [
              "At pick-up the shop checks the drone, batteries and accessories with you and takes photos. At return they check again and take photos. These photos are our record of the condition.",
              "You are responsible for the drone, batteries, controller and everything in the kit from the moment you take it until the shop has accepted it back.",
              "Return everything by the end time you booked. After a {grace}-minute grace period, a late fee equal to one hour's rate (drone plus controller) is charged for each hour or part of an hour you are late. It is charged to the card you booked with, or paid in cash at the shop if you choose.",
              "You can swap used batteries for charged ones at any of our shops during your rental, not only the one you rented from. Each swap is charged at the battery price shown at the shop, to your saved card or in cash. You still return the drone and all your batteries to the shop you rented from.",
            ],
          },
        ],
      },
      {
        title: "6. Damage and loss",
        blocks: [
          {
            ul: [
              "If the drone or controller comes back damaged, the shop records what is damaged with photos. Your deposit stays on hold, and we review the damage that evening. We then charge only the cost of the repair, up to the amount held. The rest of the deposit is released.",
              "If a drone, controller or goggles set is lost (including flown out of reach, into the sea or a river, or not returned), we keep the deposit held for that item in full.",
              "Normal wear that comes from careful use is not damage.",
              "If you think a charge is wrong, contact us within 14 days of the return. We will look at the photos with you.",
            ],
          },
        ],
      },
      {
        title: "7. Flying safely and legally",
        blocks: [
          { p: "You are the pilot and are responsible for how the drone is flown. You must:" },
          {
            ul: [
              "follow Malaysian law and the rules of the Civil Aviation Authority of Malaysia (CAAM), including keeping away from airports, airfields, military and other restricted areas;",
              "keep the drone within your sight, away from people, crowds, roads and other aircraft, and respect other people's privacy;",
              "not fly in rain or strong wind. Online booking is blocked when the forecast wind at the shop is stronger than the drone's limit ({neo2Wind} m/s for the Neo 2, {neoWind} m/s for the Neo). Even below that limit, do not fly if conditions feel unsafe, especially over water or near a beach;",
              "not fly under the influence of alcohol or drugs, or use the drone to harm, harass or spy on anyone;",
              "not lend, sublet or resell the equipment, open it, repair it, or remove any labels.",
            ],
          },
          {
            p: "Breaking these rules can cost you your deposit and may be reported to the authorities. We can refuse a rental, or end it, if we think the equipment or other people are at risk.",
          },
        ],
      },
      {
        title: "8. Cancellations and refunds",
        blocks: [
          {
            p: "If you cancel at least {freeHours} hours before your start time, you get the rental fee back in full. The full details are in our {link:refunds}.",
          },
        ],
      },
      {
        title: "9. Our responsibility",
        blocks: [
          {
            p: "We provide the equipment as it is and look after it carefully, but we are not liable for indirect or consequential loss, such as lost footage, missed moments or claims by other people, beyond the rental fee and deposit you paid for that booking. You are responsible for any injury, damage to property or claim caused by your flying. Nothing in these terms limits any right or liability that cannot be limited under Malaysian law.",
          },
        ],
      },
      {
        title: "10. Changes to these terms",
        blocks: [{ p: "We may update these terms. The terms in force when you make a booking apply to that booking." }],
      },
      {
        title: "11. Governing law and contact",
        blocks: [
          { p: "These terms are governed by the laws of Malaysia, and disputes are subject to the courts of Malaysia. Questions? See our {link:contact}." },
        ],
      },
    ],
  } as LegalPage,
  refunds: {
    title: "Refund & Cancellation Policy",
    description: "When ProCam Rental refunds a booking, how cancellations work, and how card deposits are released.",
    sections: [
      {
        title: "1. You cancel",
        blocks: [
          {
            ul: [
              "Cancel at least {freeHours} hours before your start time: you get the whole rental fee back.",
              "Cancel less than {freeHours} hours before the start, or do not turn up: the rental fee is not refunded. If we can rent the drone to someone else for that time, we will refund you.",
              "To cancel, contact us (see the Contact page) with your booking number, the name and the phone number you booked with.",
            ],
          },
        ],
      },
      {
        title: "2. We cancel, or something goes wrong: full refund",
        blocks: [
          { p: "You get the full rental fee back, and your deposit hold is released, when:" },
          {
            ul: [
              "the last drone for your time was taken by someone who paid just before you. This is refunded automatically and you are asked to choose another time;",
              "the wind forecast is above the drone's limit, or the shop judges the weather or the place unsafe to fly, and you are not able to rebook;",
              "the shop cannot give you the drone you booked, or the drone, battery or controller is faulty at hand-over;",
              "the shop cannot confirm who you are, or your ID does not match your booking;",
              "we cancel for any other reason.",
            ],
          },
          { p: "If we can offer you another time or drone instead, you can accept that, or take the refund." },
        ],
      },
      {
        title: "3. Once the drone is out",
        blocks: [
          {
            ul: [
              "The rental fee is not refunded for a rental you cut short or for time you did not use, unless the drone stops working through no fault of yours. In that case we refund the unused hours, or give you a replacement drone.",
              "Late fees and battery swaps are not refunded unless we charged them by mistake.",
            ],
          },
        ],
      },
      {
        title: "4. Your deposit",
        blocks: [
          {
            ul: [
              "The deposit is only ever a hold on your card. If everything comes back in good condition, the whole hold is released. No money was taken, so there is nothing to refund.",
              "If something is damaged, we charge only the cost of the repair, up to the amount held, and release the rest. If something is lost we keep the deposit held for that item. See the Terms for how this works.",
              "Your bank decides how fast a released hold disappears from your statement. This usually takes a few working days. A hold that is not captured is released automatically after about {holdDays} days.",
            ],
          },
        ],
      },
      {
        title: "5. How refunds are paid",
        blocks: [
          {
            p: "Refunds go back to the card you paid with, in Malaysian Ringgit. We start the refund straight away. Your bank may take 5 to 10 working days to show it. Fees charged by the payment processor are not returned to us, but we never take them out of your refund. If you paid in cash at the shop, the shop returns the cash.",
          },
        ],
      },
      {
        title: "6. A charge you disagree with",
        blocks: [
          {
            p: "If you think a damage charge, late fee or any other charge is wrong, contact us within 14 days. We will go through the hand-over and return photos with you and correct it if we got it wrong. Please contact us first, before asking your bank to reverse the payment, so we can fix it quickly.",
          },
        ],
      },
      {
        title: "7. Contact",
        blocks: [{ p: "Send us your booking number on the {link:contact}. See also the {link:terms}." }],
      },
    ],
  } as LegalPage,
  privacy: {
    title: "Privacy Policy",
    description: "What personal data ProCam Rental collects, why, who sees it and how to ask us about it.",
    sections: [
      {
        title: "1. Who is responsible",
        blocks: [
          {
            p: "ProCam Rental decides how your personal data is used for your booking. We follow Malaysia's Personal Data Protection Act 2010 (PDPA). Our contact details are on the {link:contact}.",
          },
        ],
      },
      {
        title: "2. What we collect",
        blocks: [
          {
            ul: [
              "Your name, phone number and email, to make and manage your booking. If you tick \"WhatsApp me about my booking\", we also use your phone number to send WhatsApp messages about that booking (the confirmation, reminders, how to swap a battery and refund notices). You can stop them any time by replying STOP.",
              "An identity check: a photo of your MyKad or passport and a live selfie, taken in the check run by our verification provider, Didit. We receive the result of the check (passed or not) and the reference needed to match it to your booking. We do not keep our own copy of your ID photo or selfie. The shop staff also look at your photo ID when you collect the drone.",
              "Payment information. Your card details go straight to our payment processor, Stripe. We never see or store your card number. We keep a Stripe reference to your payment and saved card so we can release your deposit, and charge late fees, battery swaps or damage you agreed to.",
              "Photos of the drone and its accessories at hand-over and return, and notes about their condition. They show equipment, not you.",
              "Booking details: what you rented, when, from which shop, what you paid, and any late fee or damage review.",
              "Basic technical data when you use the site, such as the language you chose (kept in a cookie), and which step of the booking you reached, counted with a random code kept only in your browser tab and not linked to you, so we can see where booking is confusing. We do not run advertising trackers.",
            ],
          },
        ],
      },
      {
        title: "3. Why we use it",
        blocks: [
          {
            ul: [
              "To confirm you are eligible, take your payment and hold your deposit.",
              "To hand over and take back the equipment, and to deal with late returns, damage and loss.",
              "To contact you about your booking and to give support.",
              "To keep our records, prevent fraud and meet legal and tax obligations.",
            ],
          },
          { p: "We do not sell your personal data, and we do not use it for advertising by other companies." },
        ],
      },
      {
        title: "4. Who else sees it",
        blocks: [
          {
            ul: [
              "The shop that rents you the drone sees your name, phone number and booking so that they can hand over the drone to the right person.",
              "Stripe (payments), Didit (identity check), Supabase (our database), Vercel (our website hosting) and Meta (WhatsApp, only if you asked for WhatsApp messages) process data for us under their own security and privacy terms. Some of them store data outside Malaysia.",
              "A weather service gets only the location of the shop to check the wind, never anything about you.",
              "The authorities, where the law requires, or to protect our equipment and rights, for example in a dispute or a case of theft.",
            ],
          },
        ],
      },
      {
        title: "5. How long we keep it",
        blocks: [
          {
            p: "We keep booking and payment records for as long as we need them for the booking, for disputes and for the time the law requires us to keep accounting records. After that we delete them or remove what identifies you.",
          },
        ],
      },
      {
        title: "6. Your rights",
        blocks: [
          {
            p: "Under the PDPA you can ask to see the personal data we hold about you, ask us to correct it, and ask us to stop using it for something that is not needed for your booking. Contact us through the {link:contact}. We may need to check who you are first, and we may have to keep some records the law requires. If you cannot agree to us using the data we need for an identity check or a payment, we cannot rent you a drone.",
          },
        ],
      },
      {
        title: "7. Security",
        blocks: [
          {
            p: "Our website uses an encrypted connection. Access to bookings and personal data is limited to the people who need it for the rental. No system is perfectly secure, so please tell us at once if you think your data has been misused.",
          },
        ],
      },
      {
        title: "8. Changes",
        blocks: [{ p: "We may update this policy. The date at the top shows when it last changed." }],
      },
    ],
  } as LegalPage,
  faq: faqEn,
  contact: {
    title: "Contact",
    description: "How to reach ProCam Rental and where to collect your drone.",
    helpTitle: "Questions, cancellations and refunds",
    help: "Please include your booking number (it starts with DBK-) and the name and phone number you booked with, so we can find your booking quickly.",
    emailLabel: "Email",
    phoneLabel: "Phone / WhatsApp",
    staffNote: "You can also ask the staff at the shop where you collect your drone.",
    faqNote: "Quick answers to common questions are in the {link:faq}.",
    shopsTitle: "Our shops",
    businessTitle: "The business",
    business: (name: string) => `${name}, Malaysia.`,
    businessRegistered: (registered: string, brand: string) => `${registered}, trading as ${brand}, Malaysia.`,
    ssm: (n: string) => `SSM registration number: ${n}.`,
  },
};

export type LegalText = typeof legalEn;

export const legalMs: LegalText = {
  updated: (date) => `Dikemas kini kali terakhir pada ${date}.`,
  navLabel: "Halaman undang-undang",
  nav: { terms: "Terma", refunds: "Bayaran balik", privacy: "Privasi", faq: "Soalan lazim", contact: "Hubungi kami" },
  links: { terms: "Terma & Syarat", refunds: "Dasar Bayaran Balik & Pembatalan", privacy: "Dasar Privasi", contact: "halaman Hubungi Kami", faq: "Soalan Lazim" },
  terms: {
    title: "Terma & Syarat",
    description: "Terma untuk menyewa dron DJI daripada ProCam Rental: tempahan, bayaran, deposit, penggunaan, pemulangan lewat dan kerosakan.",
    sections: [
      {
        title: "1. Siapa kami dan apa yang kami sewakan",
        blocks: [
          {
            p: "{business} menyewakan dron kamera DJI bersaiz kecil di Malaysia: DJI Neo 2 dan DJI Neo asal, dengan pilihan alat kawalan RC-N3 atau Goggles N3 dengan alat kawalan Motion 3. Anda mengambil dan memulangkan dron di salah satu kedai rakan kongsi kami di Kajang atau Port Dickson. Lihat {link:contact} kami untuk kedai-kedai tersebut.",
          },
          { p: "Dengan membuat tempahan, anda bersetuju dengan terma ini, {link:refunds} kami dan {link:privacy} kami." },
        ],
      },
      {
        title: "2. Siapa yang boleh menyewa",
        blocks: [
          {
            p: "Anda mestilah berumur sekurang-kurangnya 18 tahun dan mampu membuat perjanjian yang mengikat. Sebelum kami menyimpan dron untuk anda, anda menyelesaikan semakan identiti: gambar MyKad atau pasport anda dan swafoto langsung, dibuat pada telefon anda melalui pembekal pengesahan kami. Bawa kad pengenalan bergambar yang sama apabila anda mengambil dron: kakitangan kedai menyemaknya dengan tempahan anda dan boleh menolak sewaan jika anda tidak dapat menunjukkannya, jika ia tidak sepadan, atau jika mereka mempunyai sebab yang munasabah untuk meragui siapa anda. Dalam keadaan itu yuran sewa dikembalikan sepenuhnya.",
          },
        ],
      },
      {
        title: "3. Tempahan, harga dan bayaran",
        blocks: [
          {
            ul: [
              "Semua harga adalah dalam Ringgit Malaysia (MYR). Harga yang anda lihat pada halaman tempahan sebelum membayar ialah harga yang anda bayar: kadar sejam untuk dron yang anda pilih, ditambah alat kawalan jika anda menambahnya, ditambah pilihan bateri.",
              "Tempahan dalam talian hanya disahkan selepas bayaran kad anda berjaya. Sebelum itu tiada dron disimpan untuk anda.",
              "Jika dua orang membayar untuk dron terakhir yang sama, bayaran pertama menang. Orang lain dikembalikan wangnya sepenuhnya secara automatik dan diminta memilih masa lain.",
              "Sewaan walk-in di kedai boleh dibayar dengan kad, atau yuran sewa boleh dibayar secara tunai di kedai. Kad sentiasa diperlukan untuk deposit.",
              "Bayaran kad diproses oleh Stripe. Kami tidak pernah melihat atau menyimpan nombor kad anda.",
            ],
          },
        ],
      },
      {
        title: "4. Deposit keselamatan",
        blocks: [
          {
            p: "Deposit yang boleh dikembalikan ditahan pada kad anda apabila tempahan anda dibayar: {neo2Dep} untuk Neo 2 dan {neoDep} untuk Neo, ditambah {rcDep} jika anda menambah alat kawalan RC-N3 atau {goggDep} jika anda menambah Goggles N3 dan alat kawalan Motion 3. Deposit yang tepat ditunjukkan sebelum anda membayar.",
          },
          {
            ul: [
              "Deposit ialah tahanan pada kad anda, bukan caj. Tiada apa-apa diambil daripadanya melainkan sesuatu rosak, hilang atau terhutang.",
              "Tahanan dilepaskan apabila dron dan alat kawalan dipulangkan dalam keadaan baik. Bank anda mungkin mengambil beberapa hari untuk menunjukkannya sebagai dilepaskan. Satu tahanan bertahan paling lama kira-kira {holdDays} hari.",
              "Deposit ialah jumlah paling banyak yang kami ambil untuk kerosakan atau kehilangan peralatan. Jika pembaikan atau penggantian menelan belanja lebih daripada deposit, kami menanggung bezanya. Deposit tidak meliputi caj lewat, bateri tambahan atau apa-apa lagi yang anda hutang, yang dicaj secara berasingan.",
            ],
          },
        ],
      },
      {
        title: "5. Mengambil dan memulangkan dron",
        blocks: [
          {
            ul: [
              "Semasa pengambilan, kedai menyemak dron, bateri dan aksesori bersama anda dan mengambil gambar. Semasa pemulangan, mereka menyemak sekali lagi dan mengambil gambar. Gambar-gambar ini ialah rekod keadaan kami.",
              "Anda bertanggungjawab ke atas dron, bateri, alat kawalan dan segala-galanya dalam set itu sejak anda mengambilnya sehingga kedai menerimanya kembali.",
              "Pulangkan semuanya sebelum masa tamat yang anda tempah. Selepas tempoh bertolak ansur {grace} minit, caj lewat bersamaan kadar satu jam (dron ditambah alat kawalan) dikenakan bagi setiap jam atau sebahagian jam anda lewat. Ia dicaj pada kad yang anda gunakan untuk menempah, atau dibayar secara tunai di kedai jika anda memilih begitu.",
              "Anda boleh menukar bateri yang telah digunakan dengan yang telah dicas di mana-mana kedai kami semasa sewaan anda, bukan hanya kedai tempat anda menyewa. Setiap pertukaran dicaj pada harga bateri yang ditunjukkan di kedai, pada kad tersimpan anda atau secara tunai. Anda masih perlu memulangkan dron dan semua bateri ke kedai tempat anda menyewa.",
            ],
          },
        ],
      },
      {
        title: "6. Kerosakan dan kehilangan",
        blocks: [
          {
            ul: [
              "Jika dron atau alat kawalan dipulangkan dalam keadaan rosak, kedai merekodkan apa yang rosak dengan gambar. Deposit anda kekal ditahan, dan kami menyemak kerosakan itu pada petang tersebut. Kami kemudian hanya mengecaj kos pembaikan, sehingga jumlah yang ditahan. Baki deposit dilepaskan.",
              "Jika dron, alat kawalan atau set gogal hilang (termasuk diterbangkan di luar jangkauan, ke dalam laut atau sungai, atau tidak dipulangkan), kami menyimpan penuh deposit yang ditahan untuk item itu.",
              "Kehausan biasa akibat penggunaan yang berhati-hati bukan kerosakan.",
              "Jika anda fikir sesuatu caj itu salah, hubungi kami dalam tempoh 14 hari selepas pemulangan. Kami akan meneliti gambar bersama anda.",
            ],
          },
        ],
      },
      {
        title: "7. Terbang dengan selamat dan mengikut undang-undang",
        blocks: [
          { p: "Anda ialah juruterbang dan bertanggungjawab bagaimana dron diterbangkan. Anda mesti:" },
          {
            ul: [
              "mematuhi undang-undang Malaysia dan peraturan Pihak Berkuasa Penerbangan Awam Malaysia (CAAM), termasuk menjauhi lapangan terbang, lapangan penerbangan, kawasan tentera dan kawasan larangan lain;",
              "memastikan dron dalam pandangan anda, jauh daripada orang ramai, jalan raya dan pesawat lain, dan menghormati privasi orang lain;",
              "tidak terbang semasa hujan atau angin kencang. Tempahan dalam talian disekat apabila ramalan angin di kedai lebih kuat daripada had dron ({neo2Wind} m/s untuk Neo 2, {neoWind} m/s untuk Neo). Walaupun di bawah had itu, jangan terbang jika keadaan terasa tidak selamat, terutamanya di atas air atau berhampiran pantai;",
              "tidak terbang di bawah pengaruh alkohol atau dadah, atau menggunakan dron untuk mencederakan, mengganggu atau mengintip sesiapa;",
              "tidak meminjamkan, menyewakan semula atau menjual semula peralatan, membukanya, membaikinya, atau menanggalkan sebarang label.",
            ],
          },
          {
            p: "Melanggar peraturan ini boleh menyebabkan anda kehilangan deposit dan mungkin dilaporkan kepada pihak berkuasa. Kami boleh menolak sewaan, atau menamatkannya, jika kami fikir peralatan atau orang lain berada dalam bahaya.",
          },
        ],
      },
      {
        title: "8. Pembatalan dan bayaran balik",
        blocks: [
          {
            p: "Jika anda membatalkan sekurang-kurangnya {freeHours} jam sebelum masa mula anda, anda mendapat balik yuran sewa sepenuhnya. Butiran penuh terdapat dalam {link:refunds} kami.",
          },
        ],
      },
      {
        title: "9. Tanggungjawab kami",
        blocks: [
          {
            p: "Kami menyediakan peralatan seperti sedia ada dan menjaganya dengan teliti, tetapi kami tidak bertanggungjawab atas kerugian tidak langsung atau berbangkit, seperti rakaman yang hilang, detik yang terlepas atau tuntutan oleh orang lain, melebihi yuran sewa dan deposit yang anda bayar untuk tempahan itu. Anda bertanggungjawab atas sebarang kecederaan, kerosakan harta atau tuntutan yang disebabkan oleh penerbangan anda. Tiada apa-apa dalam terma ini yang menghadkan hak atau liabiliti yang tidak boleh dihadkan di bawah undang-undang Malaysia.",
          },
        ],
      },
      {
        title: "10. Perubahan pada terma ini",
        blocks: [{ p: "Kami boleh mengemas kini terma ini. Terma yang berkuat kuasa semasa anda membuat tempahan terpakai kepada tempahan itu." }],
      },
      {
        title: "11. Undang-undang yang mengawal dan hubungan",
        blocks: [
          { p: "Terma ini ditadbir oleh undang-undang Malaysia, dan pertikaian tertakluk kepada mahkamah Malaysia. Ada soalan? Lihat {link:contact} kami." },
        ],
      },
    ],
  },
  refunds: {
    title: "Dasar Bayaran Balik & Pembatalan",
    description: "Bila ProCam Rental mengembalikan wang tempahan, bagaimana pembatalan berfungsi, dan bagaimana deposit kad dilepaskan.",
    sections: [
      {
        title: "1. Anda membatalkan",
        blocks: [
          {
            ul: [
              "Batalkan sekurang-kurangnya {freeHours} jam sebelum masa mula anda: anda mendapat balik seluruh yuran sewa.",
              "Batalkan kurang daripada {freeHours} jam sebelum masa mula, atau tidak hadir: yuran sewa tidak dikembalikan. Jika kami dapat menyewakan dron itu kepada orang lain pada masa tersebut, kami akan mengembalikan wang anda.",
              "Untuk membatalkan, hubungi kami (lihat halaman Hubungi Kami) dengan nombor tempahan anda, nama dan nombor telefon yang anda gunakan semasa menempah.",
            ],
          },
        ],
      },
      {
        title: "2. Kami membatalkan, atau sesuatu tidak kena: bayaran balik penuh",
        blocks: [
          { p: "Anda mendapat balik yuran sewa sepenuhnya, dan tahanan deposit anda dilepaskan, apabila:" },
          {
            ul: [
              "dron terakhir untuk masa anda diambil oleh seseorang yang membayar sebelum anda. Ini dikembalikan secara automatik dan anda diminta memilih masa lain;",
              "ramalan angin melebihi had dron, atau kedai menilai cuaca atau tempat itu tidak selamat untuk terbang, dan anda tidak dapat menempah semula;",
              "kedai tidak dapat memberikan dron yang anda tempah, atau dron, bateri atau alat kawalan rosak semasa penyerahan;",
              "kedai tidak dapat mengesahkan siapa anda, atau kad pengenalan anda tidak sepadan dengan tempahan anda;",
              "kami membatalkan atas sebab lain.",
            ],
          },
          { p: "Jika kami dapat menawarkan masa atau dron lain sebagai ganti, anda boleh menerimanya, atau mengambil bayaran balik." },
        ],
      },
      {
        title: "3. Selepas dron dibawa keluar",
        blocks: [
          {
            ul: [
              "Yuran sewa tidak dikembalikan untuk sewaan yang anda pendekkan atau untuk masa yang tidak anda gunakan, melainkan dron berhenti berfungsi bukan atas kesalahan anda. Dalam kes itu kami mengembalikan jam yang tidak digunakan, atau memberikan dron ganti.",
              "Caj lewat dan pertukaran bateri tidak dikembalikan melainkan kami mengecajnya secara tersilap.",
            ],
          },
        ],
      },
      {
        title: "4. Deposit anda",
        blocks: [
          {
            ul: [
              "Deposit hanyalah tahanan pada kad anda. Jika semuanya dipulangkan dalam keadaan baik, seluruh tahanan dilepaskan. Tiada wang diambil, jadi tiada apa yang perlu dikembalikan.",
              "Jika sesuatu rosak, kami hanya mengecaj kos pembaikan, sehingga jumlah yang ditahan, dan melepaskan bakinya. Jika sesuatu hilang kami menyimpan deposit yang ditahan untuk item itu. Lihat Terma untuk cara ini berfungsi.",
              "Bank anda menentukan berapa cepat tahanan yang dilepaskan hilang daripada penyata anda. Ini biasanya mengambil beberapa hari bekerja. Tahanan yang tidak dikutip dilepaskan secara automatik selepas kira-kira {holdDays} hari.",
            ],
          },
        ],
      },
      {
        title: "5. Bagaimana bayaran balik dibayar",
        blocks: [
          {
            p: "Bayaran balik dikembalikan ke kad yang anda gunakan untuk membayar, dalam Ringgit Malaysia. Kami memulakan bayaran balik dengan segera. Bank anda mungkin mengambil masa 5 hingga 10 hari bekerja untuk menunjukkannya. Yuran yang dikenakan oleh pemproses pembayaran tidak dikembalikan kepada kami, tetapi kami tidak pernah memotongnya daripada bayaran balik anda. Jika anda membayar tunai di kedai, kedai mengembalikan wang tunai itu.",
          },
        ],
      },
      {
        title: "6. Caj yang anda tidak bersetuju",
        blocks: [
          {
            p: "Jika anda fikir caj kerosakan, caj lewat atau mana-mana caj lain itu salah, hubungi kami dalam tempoh 14 hari. Kami akan meneliti gambar penyerahan dan pemulangan bersama anda dan membetulkannya jika kami tersilap. Sila hubungi kami dahulu, sebelum meminta bank anda membatalkan bayaran, supaya kami dapat membetulkannya dengan cepat.",
          },
        ],
      },
      {
        title: "7. Hubungi",
        blocks: [{ p: "Hantarkan nombor tempahan anda kepada kami di {link:contact}. Lihat juga {link:terms}." }],
      },
    ],
  },
  privacy: {
    title: "Dasar Privasi",
    description: "Data peribadi apa yang dikumpul oleh ProCam Rental, mengapa, siapa yang melihatnya dan cara bertanya kepada kami.",
    sections: [
      {
        title: "1. Siapa yang bertanggungjawab",
        blocks: [
          {
            p: "ProCam Rental menentukan bagaimana data peribadi anda digunakan untuk tempahan anda. Kami mematuhi Akta Perlindungan Data Peribadi 2010 (PDPA) Malaysia. Butiran hubungan kami terdapat di {link:contact}.",
          },
        ],
      },
      {
        title: "2. Apa yang kami kumpul",
        blocks: [
          {
            ul: [
              "Nama, nombor telefon dan e-mel anda, untuk membuat dan mengurus tempahan anda. Jika anda menandakan \"WhatsApp saya tentang tempahan saya\", kami juga menggunakan nombor telefon anda untuk menghantar mesej WhatsApp tentang tempahan itu (pengesahan, peringatan, cara menukar bateri dan notis bayaran balik). Anda boleh berhenti pada bila-bila masa dengan membalas STOP.",
              "Semakan identiti: gambar MyKad atau pasport anda dan swafoto langsung, diambil dalam semakan yang dijalankan oleh pembekal pengesahan kami, Didit. Kami menerima keputusan semakan itu (lulus atau tidak) dan rujukan yang diperlukan untuk memadankannya dengan tempahan anda. Kami tidak menyimpan salinan gambar kad pengenalan atau swafoto anda sendiri. Kakitangan kedai juga melihat kad pengenalan bergambar anda apabila anda mengambil dron.",
              "Maklumat pembayaran. Butiran kad anda terus ke pemproses pembayaran kami, Stripe. Kami tidak pernah melihat atau menyimpan nombor kad anda. Kami menyimpan rujukan Stripe kepada pembayaran dan kad tersimpan anda supaya kami boleh melepaskan deposit anda, dan mengecaj caj lewat, pertukaran bateri atau kerosakan yang anda setujui.",
              "Gambar dron dan aksesorinya semasa penyerahan dan pemulangan, dan catatan tentang keadaannya. Ia menunjukkan peralatan, bukan anda.",
              "Butiran tempahan: apa yang anda sewa, bila, dari kedai mana, berapa yang anda bayar, dan sebarang caj lewat atau semakan kerosakan.",
              "Data teknikal asas apabila anda menggunakan laman ini, seperti bahasa yang anda pilih (disimpan dalam kuki), dan langkah tempahan yang anda capai, dikira dengan kod rawak yang hanya disimpan dalam tab pelayar anda dan tidak dikaitkan dengan anda, supaya kami dapat melihat di mana tempahan mengelirukan. Kami tidak menggunakan penjejak iklan.",
            ],
          },
        ],
      },
      {
        title: "3. Mengapa kami menggunakannya",
        blocks: [
          {
            ul: [
              "Untuk mengesahkan anda layak, mengambil bayaran anda dan menahan deposit anda.",
              "Untuk menyerahkan dan mengambil semula peralatan, dan menangani pemulangan lewat, kerosakan dan kehilangan.",
              "Untuk menghubungi anda tentang tempahan anda dan memberikan sokongan.",
              "Untuk menyimpan rekod kami, mencegah penipuan dan memenuhi kewajipan undang-undang dan cukai.",
            ],
          },
          { p: "Kami tidak menjual data peribadi anda, dan kami tidak menggunakannya untuk pengiklanan oleh syarikat lain." },
        ],
      },
      {
        title: "4. Siapa lagi yang melihatnya",
        blocks: [
          {
            ul: [
              "Kedai yang menyewakan dron kepada anda melihat nama, nombor telefon dan tempahan anda supaya mereka dapat menyerahkan dron kepada orang yang betul.",
              "Stripe (pembayaran), Didit (semakan identiti), Supabase (pangkalan data kami), Vercel (pengehosan laman web kami) dan Meta (WhatsApp, hanya jika anda meminta mesej WhatsApp) memproses data untuk kami di bawah terma keselamatan dan privasi mereka sendiri. Sebahagian daripada mereka menyimpan data di luar Malaysia.",
              "Perkhidmatan cuaca hanya mendapat lokasi kedai untuk menyemak angin, tidak pernah apa-apa tentang anda.",
              "Pihak berkuasa, apabila dikehendaki oleh undang-undang, atau untuk melindungi peralatan dan hak kami, contohnya dalam pertikaian atau kes kecurian.",
            ],
          },
        ],
      },
      {
        title: "5. Berapa lama kami menyimpannya",
        blocks: [
          {
            p: "Kami menyimpan rekod tempahan dan pembayaran selama kami memerlukannya untuk tempahan, untuk pertikaian dan selama tempoh yang dikehendaki oleh undang-undang untuk menyimpan rekod perakaunan. Selepas itu kami memadamkannya atau membuang apa yang mengenal pasti anda.",
          },
        ],
      },
      {
        title: "6. Hak anda",
        blocks: [
          {
            p: "Di bawah PDPA anda boleh meminta untuk melihat data peribadi yang kami simpan tentang anda, meminta kami membetulkannya, dan meminta kami berhenti menggunakannya untuk sesuatu yang tidak diperlukan untuk tempahan anda. Hubungi kami melalui {link:contact}. Kami mungkin perlu menyemak siapa anda dahulu, dan kami mungkin perlu menyimpan sebahagian rekod yang dikehendaki oleh undang-undang. Jika anda tidak boleh bersetuju dengan kami menggunakan data yang kami perlukan untuk semakan identiti atau pembayaran, kami tidak dapat menyewakan dron kepada anda.",
          },
        ],
      },
      {
        title: "7. Keselamatan",
        blocks: [
          {
            p: "Laman web kami menggunakan sambungan yang disulitkan. Akses kepada tempahan dan data peribadi dihadkan kepada orang yang memerlukannya untuk sewaan. Tiada sistem yang selamat sepenuhnya, jadi sila beritahu kami dengan segera jika anda fikir data anda telah disalahgunakan.",
          },
        ],
      },
      {
        title: "8. Perubahan",
        blocks: [{ p: "Kami boleh mengemas kini dasar ini. Tarikh di bahagian atas menunjukkan bila ia terakhir berubah." }],
      },
    ],
  },
  faq: faqMs,
  contact: {
    title: "Hubungi Kami",
    description: "Cara menghubungi ProCam Rental dan di mana untuk mengambil dron anda.",
    helpTitle: "Soalan, pembatalan dan bayaran balik",
    help: "Sila sertakan nombor tempahan anda (bermula dengan DBK-) serta nama dan nombor telefon yang anda gunakan semasa menempah, supaya kami dapat mencari tempahan anda dengan cepat.",
    emailLabel: "E-mel",
    phoneLabel: "Telefon / WhatsApp",
    staffNote: "Anda juga boleh bertanya kepada kakitangan di kedai tempat anda mengambil dron.",
    faqNote: "Jawapan ringkas kepada soalan yang kerap ditanya ada dalam {link:faq}.",
    shopsTitle: "Kedai kami",
    businessTitle: "Perniagaan",
    business: (name) => `${name}, Malaysia.`,
    businessRegistered: (registered, brand) => `${registered}, berniaga sebagai ${brand}, Malaysia.`,
    ssm: (n) => `Nombor pendaftaran SSM: ${n}.`,
  },
};

export const legalZh: LegalText = {
  updated: (date) => `最后更新于 ${date}。`,
  navLabel: "法律页面",
  nav: { terms: "条款", refunds: "退款", privacy: "隐私", faq: "常见问题", contact: "联系我们" },
  links: { terms: "条款与条件", refunds: "退款与取消政策", privacy: "隐私政策", contact: "联系我们页面", faq: "常见问题" },
  terms: {
    title: "条款与条件",
    description: "向 ProCam Rental 租用 DJI 无人机的条款：预订、付款、押金、使用、逾期归还和损坏。",
    sections: [
      {
        title: "1. 我们是谁，租什么",
        blocks: [
          {
            p: "{business}在马来西亚出租小型 DJI 摄影无人机：DJI Neo 2 和原版 DJI Neo，可选加 RC-N3 遥控器或 Goggles N3 配 Motion 3 控制器。您在加影或波德申的合作门店取机和还机。门店信息请见我们的{link:contact}。",
          },
          { p: "预订即表示您同意本条款、我们的{link:refunds}和{link:privacy}。" },
        ],
      },
      {
        title: "2. 谁可以租用",
        blocks: [
          {
            p: "您必须年满 18 岁，并有能力订立具有约束力的协议。在我们为您保留无人机之前，您需要完成身份验证：通过我们的验证服务商，在手机上拍摄您的 MyKad 或护照，并现场自拍。取机时请带上同一份带照片的证件：店员会对照您的预订核对，如果您无法出示、证件与预订不符，或他们有充分理由怀疑您的身份，可以拒绝出租。这种情况下租金将全额退还。",
          },
        ],
      },
      {
        title: "3. 预订、价格和付款",
        blocks: [
          {
            ul: [
              "所有价格均以马来西亚令吉（MYR）计算。您付款前在预订页面看到的价格就是您要付的价格：所选无人机的每小时租金，加上您添加的遥控器，再加上电池选项。",
              "网上预订只有在您的刷卡付款成功后才算确认，在此之前我们不会为您保留无人机。",
              "如果两个人为同一台最后的无人机付款，先付款者得到。另一位会自动全额退款，并请他们选择其他时间。",
              "在门店现场租用可以刷卡付款，也可以在门店以现金支付租金。押金始终需要用银行卡。",
              "刷卡付款由 Stripe 处理。我们从不查看或保存您的卡号。",
            ],
          },
        ],
      },
      {
        title: "4. 押金",
        blocks: [
          {
            p: "预订付款时，会在您的银行卡上冻结一笔可退还的押金：Neo 2 为 {neo2Dep}，Neo 为 {neoDep}，如果加租 RC-N3 遥控器再加 {rcDep}，如果加租 Goggles N3 和 Motion 3 控制器再加 {goggDep}。确切的押金金额会在您付款前显示。",
          },
          {
            ul: [
              "押金是银行卡上的冻结，不是扣款。除非有损坏、丢失或欠款，否则不会从中扣取任何金额。",
              "无人机和遥控器完好归还后，冻结即解除。您的银行可能要几天才会显示已解除。一次冻结最长约持续 {holdDays} 天。",
              "押金是我们因设备损坏或丢失所收取的最高金额。如果维修或更换的费用超过押金，差额由我们承担。押金不包括逾期费、额外电池或您欠下的其他款项，这些将另外收取。",
            ],
          },
        ],
      },
      {
        title: "5. 取机和还机",
        blocks: [
          {
            ul: [
              "取机时，门店会与您一起检查无人机、电池和配件并拍照。还机时再检查一次并拍照。这些照片就是我们对设备状况的记录。",
              "从您取走设备起，到门店接收归还为止，无人机、电池、遥控器和套装内所有物品由您负责。",
              "请在您预订的结束时间前归还所有物品。超过 {grace} 分钟的宽限期后，每逾期一小时或不足一小时，按一小时的租金（无人机加遥控器）收取逾期费。逾期费会扣在您预订时使用的银行卡上，或按您的选择在门店付现金。",
              "租用期间，您可以在我们任何一家门店把用过的电池换成充满电的电池，不只是租机的那家。每次更换按门店显示的电池价格收费，扣在您已保存的银行卡上或付现金。您仍需把无人机和全部电池归还到您租机的门店。",
            ],
          },
        ],
      },
      {
        title: "6. 损坏和丢失",
        blocks: [
          {
            ul: [
              "如果无人机或遥控器归还时有损坏，门店会拍照记录损坏情况。您的押金继续冻结，我们会在当天傍晚评估损坏，然后只收取维修费用，最高不超过冻结金额，其余押金解除冻结。",
              "如果无人机、遥控器或眼镜套装丢失（包括飞出控制范围、掉进海里或河里，或未归还），我们会全额扣留该物品对应的押金。",
              "小心使用造成的正常磨损不算损坏。",
              "如果您认为某笔费用有误，请在归还后 14 天内联系我们。我们会与您一起查看照片。",
            ],
          },
        ],
      },
      {
        title: "7. 安全合法地飞行",
        blocks: [
          { p: "您是飞手，须对无人机的飞行方式负责。您必须：" },
          {
            ul: [
              "遵守马来西亚法律和马来西亚民航局（CAAM）的规定，包括远离机场、飞机场、军事和其他禁飞区域；",
              "让无人机保持在您的视线内，远离人群、道路和其他飞行器，并尊重他人的隐私；",
              "不要在下雨或大风中飞行。当门店所在地的风速预报超过无人机的上限（Neo 2 为 {neo2Wind} 米/秒，Neo 为 {neoWind} 米/秒）时，网上预订将被阻止。即使低于这个上限，只要觉得条件不安全，也不要飞行，尤其是在水面上或海滩附近；",
              "不要在酒精或药物影响下飞行，也不要用无人机伤害、骚扰或偷窥任何人；",
              "不要出借、转租或转售设备，不要拆开或自行维修，也不要撕掉任何标签。",
            ],
          },
          {
            p: "违反这些规定可能使您失去押金，并可能被举报给有关当局。如果我们认为设备或其他人面临风险，可以拒绝出租或终止租用。",
          },
        ],
      },
      {
        title: "8. 取消和退款",
        blocks: [
          {
            p: "如果您在开始时间至少 {freeHours} 小时前取消，租金将全额退还。详细规定见我们的{link:refunds}。",
          },
        ],
      },
      {
        title: "9. 我们的责任",
        blocks: [
          {
            p: "我们按现状提供设备并悉心维护，但对间接或后果性损失（例如丢失的影像、错过的精彩时刻或他人的索赔）不承担责任，赔偿上限为您为该次预订支付的租金和押金。因您的飞行造成的任何人身伤害、财产损失或索赔由您负责。本条款中的任何内容都不限制根据马来西亚法律无法限制的权利或责任。",
          },
        ],
      },
      {
        title: "10. 条款的变更",
        blocks: [{ p: "我们可能会更新本条款。您预订时有效的条款适用于该次预订。" }],
      },
      {
        title: "11. 适用法律和联系方式",
        blocks: [{ p: "本条款受马来西亚法律管辖，争议由马来西亚法院处理。有疑问？请见我们的{link:contact}。" }],
      },
    ],
  },
  refunds: {
    title: "退款与取消政策",
    description: "ProCam Rental 何时退还预订款项、如何取消，以及银行卡押金如何解除。",
    sections: [
      {
        title: "1. 您取消预订",
        blocks: [
          {
            ul: [
              "在开始时间至少 {freeHours} 小时前取消：全额退还租金。",
              "在开始前不足 {freeHours} 小时取消，或没有到场：租金不予退还。如果我们能把无人机在那个时段租给别人，我们会退款给您。",
              "取消请联系我们（见“联系我们”页面），并提供您的预订编号、预订时使用的姓名和手机号码。",
            ],
          },
        ],
      },
      {
        title: "2. 我们取消，或出了问题：全额退款",
        blocks: [
          { p: "在以下情况下，您将获得全额租金退款，并解除押金冻结：" },
          {
            ul: [
              "您预订时段的最后一台无人机被刚刚付款的人订走。这会自动退款，并请您选择其他时间；",
              "风速预报超过无人机上限，或门店判断天气或地点不适合飞行，而您无法改期；",
              "门店无法提供您预订的无人机，或无人机、电池或遥控器在交付时有故障；",
              "门店无法确认您的身份，或您的证件与预订不符；",
              "我们因任何其他原因取消。",
            ],
          },
          { p: "如果我们可以改为提供其他时间或其他无人机，您可以接受，也可以选择退款。" },
        ],
      },
      {
        title: "3. 无人机取走之后",
        blocks: [
          {
            ul: [
              "您提前结束租用或没有使用的时间，租金不予退还，除非无人机并非因您的过错而无法使用。在这种情况下，我们会退还未使用的小时数，或提供替换的无人机。",
              "逾期费和电池更换费不予退还，除非是我们收错了。",
            ],
          },
        ],
      },
      {
        title: "4. 您的押金",
        blocks: [
          {
            ul: [
              "押金始终只是银行卡上的冻结。如果所有物品完好归还，整笔冻结都会解除。没有扣过钱，所以无需退款。",
              "如果有损坏，我们只收取维修费用，最高不超过冻结金额，并解除其余部分。如果有物品丢失，我们会扣留该物品对应的押金。具体规定见条款。",
              "已解除的冻结多久从您的账单上消失，由您的银行决定，通常需要几个工作日。未扣取的冻结会在约 {holdDays} 天后自动解除。",
            ],
          },
        ],
      },
      {
        title: "5. 退款如何支付",
        blocks: [
          {
            p: "退款会以马来西亚令吉退回您付款时使用的银行卡。我们会立即发起退款，您的银行可能需要 5 至 10 个工作日才会显示。支付处理方收取的手续费不会退还给我们，但我们绝不会从您的退款中扣除。如果您是在门店付现金，则由门店退还现金。",
          },
        ],
      },
      {
        title: "6. 您不认同的费用",
        blocks: [
          {
            p: "如果您认为损坏费、逾期费或其他任何费用有误，请在 14 天内联系我们。我们会与您一起查看交付和归还时的照片，如果是我们搞错了就会更正。请先联系我们，再向银行申请撤销付款，这样我们才能尽快处理。",
          },
        ],
      },
      {
        title: "7. 联系方式",
        blocks: [{ p: "请在{link:contact}把您的预订编号发给我们。另请参阅{link:terms}。" }],
      },
    ],
  },
  privacy: {
    title: "隐私政策",
    description: "ProCam Rental 收集哪些个人资料、为什么收集、谁能看到，以及如何向我们查询。",
    sections: [
      {
        title: "1. 谁负责",
        blocks: [
          {
            p: "ProCam Rental 决定如何使用您的个人资料来处理您的预订。我们遵守马来西亚 2010 年《个人资料保护法令》（PDPA）。我们的联系方式见{link:contact}。",
          },
        ],
      },
      {
        title: "2. 我们收集什么",
        blocks: [
          {
            ul: [
              "您的姓名、手机号码和电子邮箱，用于办理和管理您的预订。如果您勾选“通过 WhatsApp 通知我预订的情况”，我们还会用您的手机号码发送关于该预订的 WhatsApp 消息（确认、提醒、更换电池的方法和退款通知）。随时回复 STOP 即可停止。",
              "身份验证：由我们的验证服务商 Didit 进行的检查中，拍摄的您的 MyKad 或护照照片和现场自拍。我们会收到验证结果（通过与否）以及与您预订对应所需的参考编号。我们自己不保存您的证件照片或自拍。取机时，店员也会查看您带照片的证件。",
              "付款信息。您的银行卡资料直接交给我们的支付处理方 Stripe，我们从不查看或保存您的卡号。我们保存一个指向您付款和已保存银行卡的 Stripe 参考编号，以便解除您的押金，并收取您同意的逾期费、电池更换费或损坏费用。",
              "交付和归还时无人机及配件的照片，以及对其状况的记录。照片拍的是设备，不是您。",
              "预订资料：您租了什么、什么时候、在哪家门店、付了多少钱，以及任何逾期费或损坏评估。",
              "您使用本网站时的基本技术数据，例如您选择的语言（保存在 cookie 中），以及您预订到了哪一步；这是用仅保存在您浏览器标签页中、与您本人无关的随机代码统计的，用来了解预订哪里让人困惑。我们不使用广告追踪器。",
            ],
          },
        ],
      },
      {
        title: "3. 我们为什么使用",
        blocks: [
          {
            ul: [
              "确认您符合条件、收取付款并冻结押金。",
              "交付和收回设备，并处理逾期归还、损坏和丢失。",
              "就您的预订联系您并提供支持。",
              "保存我们的记录、防止欺诈，并履行法律和税务义务。",
            ],
          },
          { p: "我们不出售您的个人资料，也不会把它用于其他公司的广告。" },
        ],
      },
      {
        title: "4. 还有谁能看到",
        blocks: [
          {
            ul: [
              "租给您无人机的门店可以看到您的姓名、手机号码和预订，以便把无人机交给正确的人。",
              "Stripe（付款）、Didit（身份验证）、Supabase（我们的数据库）、Vercel（我们的网站托管）和 Meta（WhatsApp，仅在您要求 WhatsApp 消息时）按照各自的安全和隐私条款为我们处理数据。其中一些会把数据存放在马来西亚境外。",
              "天气服务只会收到门店的位置来查询风速，绝不会收到任何关于您的信息。",
              "依法需要时，或为了保护我们的设备和权利（例如发生争议或盗窃案件时），有关当局也可能获得资料。",
            ],
          },
        ],
      },
      {
        title: "5. 我们保存多久",
        blocks: [
          {
            p: "只要处理预订、争议和法律规定的会计记录保存期间需要，我们就会保存预订和付款记录。之后我们会将其删除，或去除能识别您身份的信息。",
          },
        ],
      },
      {
        title: "6. 您的权利",
        blocks: [
          {
            p: "根据 PDPA，您可以要求查看我们持有的关于您的个人资料、要求我们更正，并要求我们停止把它用于您预订不需要的用途。请通过{link:contact}联系我们。我们可能需要先核实您的身份，也可能必须保留法律要求保存的部分记录。如果您不同意我们使用身份验证或付款所需的资料，我们就无法把无人机租给您。",
          },
        ],
      },
      {
        title: "7. 安全",
        blocks: [
          {
            p: "我们的网站使用加密连接。只有租用服务需要的人员才能查看预订和个人资料。没有任何系统是绝对安全的，如果您认为自己的资料被滥用，请立即告诉我们。",
          },
        ],
      },
      {
        title: "8. 变更",
        blocks: [{ p: "我们可能会更新本政策。顶部的日期显示了最近一次变更的时间。" }],
      },
    ],
  },
  faq: faqZh,
  contact: {
    title: "联系我们",
    description: "如何联系 ProCam Rental，以及在哪里取机。",
    helpTitle: "疑问、取消和退款",
    help: "请提供您的预订编号（以 DBK- 开头）以及预订时使用的姓名和手机号码，这样我们才能尽快找到您的预订。",
    emailLabel: "电子邮箱",
    phoneLabel: "电话 / WhatsApp",
    staffNote: "您也可以向取机门店的店员询问。",
    faqNote: "常见问题的简短解答见{link:faq}。",
    shopsTitle: "我们的门店",
    businessTitle: "公司信息",
    business: (name) => `${name}，马来西亚。`,
    businessRegistered: (registered, brand) => `${registered}，以 ${brand} 名义经营，马来西亚。`,
    ssm: (n) => `SSM 注册号：${n}。`,
  },
};

const TEXTS: Record<Locale, LegalText> = { en: legalEn, ms: legalMs, zh: legalZh };

export function legalText(locale: Locale): LegalText {
  return TEXTS[locale] ?? TEXTS[DEFAULT_LOCALE];
}
