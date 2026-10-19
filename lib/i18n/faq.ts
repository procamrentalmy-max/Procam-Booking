import type { LegalBlock } from "./legal";
import { DRONE_ID_CHECK_ENABLED } from "@/lib/features";

/** The text with the online ID check (on) or without it (off): see DRONE_ID_CHECK_ENABLED in lib/features.ts. */
const idc = (on: string, off: string) => (DRONE_ID_CHECK_ENABLED ? on : off);

/**
 * The FAQ page, in English, Bahasa Melayu and Chinese. English is the master and the other two are typed against it. Answers are
 * the same blocks the legal pages use (`{ p }` paragraph, `{ ul }` bullet list), with the same {placeholders} and {link:name}
 * links, plus these numbers taken from the live pricing rules: {neo2Rate} {neoRate} {rcRate} {goggRate} {maxHours} {payMinutes}.
 *
 * The Malay and Chinese were written by Claude, not a native-speaking translator: have both checked before relying on them.
 */
export type FaqItem = { q: string; blocks: LegalBlock[] };
export type FaqSection = { title: string; items: FaqItem[] };
export type FaqPage = {
  title: string;
  description: string;
  intro: string;
  sections: FaqSection[];
  /** The closing line pointing to the Contact page. */
  stuck: string;
};

export const faqEn: FaqPage = {
  title: "Frequently asked questions",
  description: idc("Quick answers about booking, the ID check, the card deposit, flying, collecting and returning a ProCam Rental drone, and refunds.", "Quick answers about booking, the card deposit, flying, collecting and returning a ProCam Rental drone, and refunds."),
  intro: "Short answers to what customers ask most. The {link:terms} and {link:refunds} have the full rules.",
  sections: [
    {
      title: "Booking and prices",
      items: [
        {
          q: "How do I book a drone?",
          blocks: [
            {
              p: idc("Open the booking page, pick a shop (on the map, or tap Nearest to me), choose your drone, how you want to fly it and the batteries, then a day and a time. Enter your name, phone and email, do a quick ID check, and pay. You then get a booking page with a QR code to show at the shop.", "Open the booking page, pick a shop (on the map, or tap Nearest to me), choose your drone, how you want to fly it and the batteries, then a day and a time. Enter your name, phone and email, and pay. You then get a booking page with a QR code to show at the shop."),
            },
          ],
        },
        {
          q: "How much does it cost?",
          blocks: [
            {
              ul: [
                "The DJI Neo 2 is {neo2Rate} an hour and the DJI Neo is {neoRate} an hour.",
                "The RC-N3 controller adds {rcRate} an hour. The Goggles N3 with Motion 3 controller adds {goggRate} an hour. Flying with just your own phone adds nothing.",
                "The battery option you choose is added once.",
              ],
            },
            { p: "The total on the booking page before you pay is what you pay. On top of that a refundable deposit is held on your card (see Deposit below)." },
          ],
        },
        {
          q: "How long can I rent for?",
          blocks: [{ p: "From 1 to {maxHours} hours. Start times are every 30 minutes, and your rental has to end before the shop closes. The booking page only shows times that are free." }],
        },
        {
          q: "Do I need an account?",
          blocks: [{ p: "No. We only need your name, phone number and email." }],
        },
        {
          q: "How long do I have to pay?",
          blocks: [
            {
              p: "{payMinutes} minutes. A drone is only held for you once your payment has gone through. If two people pay for the same last drone, the first payment wins and the other person is refunded in full automatically, then asked to pick another time.",
            },
          ],
        },
        {
          q: "Can I walk in without booking?",
          blocks: [
            {
              p: "Yes, if a drone is free. Scan the walk-in QR code at the shop. You can pay the rental fee by card or in cash at the shop. A card is always needed for the deposit.",
            },
          ],
        },
      ],
    },
    {
      title: idc("ID check and who can rent", "Who can rent"),
      items: [
        {
          q: idc("Why do you ask for an ID check?", "Why do staff check my ID?"),
          blocks: [
            {
              p: idc("So a drone is only rented to a real person who can be held responsible for it. It is a photo of your MyKad or passport and a live selfie, done on your phone through our verification provider. It comes before payment, so you are not charged if it does not pass. If you think it was wrong, contact us.", "So a drone is only rented to a real person who can be held responsible for it. The staff check your MyKad or passport against your booking when you collect the drone. If you think they were wrong, contact us."),
            },
          ],
        },
        {
          q: "Do I need to bring my ID?",
          blocks: [
            {
              p: idc("Yes. Bring the same photo ID to the shop. The staff check it against your booking, and the person collecting must be the person who booked. The drone cannot be lent to someone else. If the ID cannot be shown or does not match, the rental is refunded in full.", "Yes. Bring your MyKad or passport to the shop. The staff check it against your booking, and the person collecting must be the person who booked. The drone cannot be lent to someone else. If the ID cannot be shown or does not match, the rental is refunded in full."),
            },
          ],
        },
        {
          q: "How old do I have to be?",
          blocks: [{ p: "At least 18." }],
        },
      ],
    },
    {
      title: "Deposit",
      items: [
        {
          q: "What is the deposit?",
          blocks: [
            {
              p: "A refundable hold on your card, not a charge: {neo2Dep} for the Neo 2 or {neoDep} for the Neo, plus {rcDep} if you add the RC-N3 or {goggDep} if you add the goggles. The exact amount is shown before you pay. Nothing is taken from it unless something is damaged, lost or owed.",
            },
          ],
        },
        {
          q: "When do I get it back?",
          blocks: [
            {
              p: "The hold is released when the drone and controller come back in good condition. Your bank may take a few days to show it as released. A hold that is not used is also released automatically after about {holdDays} days.",
            },
          ],
        },
        {
          q: "My booking asks me to confirm the deposit. What do I do?",
          blocks: [
            {
              p: "Sometimes your bank needs one more approval before it will hold the deposit, for example in your banking app. Your booking page then shows a button to confirm it. The shop cannot hand over the drone until the hold is in place.",
            },
          ],
        },
        {
          q: "What if something is damaged or lost?",
          blocks: [
            {
              ul: [
                "Damage: the shop records it with photos and we review it that evening. The repair cost is deducted from your deposit, up to the amount held, and the repair invoice is sent to you. The rest is released.",
                "Lost (flown out of reach, into water, or not returned): we keep the deposit held for that item.",
                "The deposit is the most we take for damage or loss. Late fees and extra batteries are charged separately.",
              ],
            },
            { p: "See the {link:terms} for the details." },
          ],
        },
      ],
    },
    {
      title: "Flying",
      items: [
        {
          q: "Phone only, controller or goggles: which should I choose?",
          blocks: [
            {
              ul: [
                "Phone only: you fly with your own phone and the DJI Fly app. Cheapest, and fine for casual flying.",
                "Controller (RC-N3): a proper controller that your phone clips into (you still need your phone). Longer control range.",
                "Goggles N3 with Motion 3: you fly by looking through the goggles and moving the Motion 3 controller. No phone needed.",
              ],
            },
          ],
        },
        {
          q: "What about wind and rain?",
          blocks: [
            {
              p: "Online booking is blocked when the forecast wind at the shop is stronger than the drone's limit: {neo2Wind} m/s for the Neo 2 and {neoWind} m/s for the Neo. Do not fly in rain, and do not fly if it feels unsafe, especially over water or near the beach. If we have to cancel because of weather and you cannot rebook, you get a full refund.",
            },
          ],
        },
        {
          q: "Where can I fly?",
          blocks: [
            {
              p: "Follow Malaysian law and the Civil Aviation Authority of Malaysia (CAAM) rules. Stay away from airports and restricted areas, keep the drone in sight, and keep clear of people, crowds and roads. See the {link:terms}.",
            },
          ],
        },
      ],
    },
    {
      title: "Collecting and returning",
      items: [
        {
          q: "Where and how do I collect the drone?",
          blocks: [
            {
              p: "At the shop you chose. Show your booking QR code and your photo ID. The shop checks the drone, batteries and accessories with you and takes photos. They do the same at return, and those photos are the record of the condition.",
            },
          ],
        },
        {
          q: "What if I am late bringing it back?",
          blocks: [
            {
              p: "There is a {grace}-minute grace period. After that, a late fee of one hour's rate (drone plus controller) is charged for each hour or part of an hour you are late. It goes to the card you booked with, or you can pay it in cash at the shop.",
            },
          ],
        },
        {
          q: "What if the battery runs flat?",
          blocks: [{ p: "Swap used batteries for fully charged ones at any of our shops during your rental, not only the one you rented from. Open your booking link, tap Battery finished? Swap it at any shop, pick the shop and show the QR to the staff. Each swap is charged at the battery price, to your saved card or in cash. When your time is up, still bring the drone and all your batteries back to the shop you rented from." }],
        },
      ],
    },
    {
      title: "Cancellations, refunds and payment",
      items: [
        {
          q: "Can I cancel?",
          blocks: [
            {
              p: "Yes. Cancel at least {freeHours} hours before your start time and you get the whole rental fee back. Later than that, the fee is not refunded. To cancel, contact us with your booking number and the name and phone you booked with.",
            },
          ],
        },
        {
          q: "When do I get my refund?",
          blocks: [{ p: "We start it straight away, back to the card you paid with. Your bank may take 5 to 10 working days to show it. See the {link:refunds}." }],
        },
        {
          q: "Is my card safe?",
          blocks: [{ p: "Card payments are handled by Stripe. We never see or store your card number." }],
        },
        {
          q: "A charge looks wrong. What do I do?",
          blocks: [{ p: "Contact us within 14 days, before asking your bank to reverse it. We will go through the photos from hand-over and return with you and correct it if we got it wrong." }],
        },
        {
          q: "Can I use the site in Malay or Chinese?",
          blocks: [{ p: "Yes. Use the EN, BM and 中 switch at the top of the page." }],
        },
      ],
    },
  ],
  stuck: "Did not find your answer? See the {link:contact}.",
};

export const faqMs: FaqPage = {
  title: "Soalan lazim",
  description: "Jawapan ringkas tentang tempahan, semakan ID, deposit kad, penerbangan, pengambilan dan pemulangan dron ProCam Rental, serta bayaran balik.",
  intro: "Jawapan ringkas kepada soalan yang paling kerap ditanya. {link:terms} dan {link:refunds} mengandungi peraturan penuh.",
  sections: [
    {
      title: "Tempahan dan harga",
      items: [
        {
          q: "Bagaimana saya menempah dron?",
          blocks: [
            {
              p: idc("Buka halaman tempahan, pilih kedai (pada peta, atau tekan Paling dekat dengan saya), pilih dron, cara anda ingin menerbangkannya serta bateri, kemudian hari dan masa. Masukkan nama, telefon dan e-mel anda, lakukan semakan ID yang ringkas, dan buat bayaran. Anda kemudian akan mendapat halaman tempahan dengan kod QR untuk ditunjukkan di kedai.", "Buka halaman tempahan, pilih kedai (pada peta, atau tekan Paling dekat dengan saya), pilih dron, cara anda ingin menerbangkannya serta bateri, kemudian hari dan masa. Masukkan nama, telefon dan e-mel anda, dan buat bayaran. Anda kemudian akan mendapat halaman tempahan dengan kod QR untuk ditunjukkan di kedai."),
            },
          ],
        },
        {
          q: "Berapakah kosnya?",
          blocks: [
            {
              ul: [
                "DJI Neo 2 ialah {neo2Rate} sejam dan DJI Neo ialah {neoRate} sejam.",
                "Alat kawalan RC-N3 menambah {rcRate} sejam. Goggles N3 dengan alat kawalan Motion 3 menambah {goggRate} sejam. Terbang dengan telefon sendiri sahaja tidak menambah apa-apa.",
                "Pilihan bateri yang anda pilih ditambah sekali sahaja.",
              ],
            },
            { p: "Jumlah pada halaman tempahan sebelum anda membayar ialah jumlah yang anda bayar. Selain itu, deposit boleh dipulangkan ditahan pada kad anda (lihat Deposit di bawah)." },
          ],
        },
        {
          q: "Berapa lama saya boleh menyewa?",
          blocks: [{ p: "Dari 1 hingga {maxHours} jam. Masa mula ialah setiap 30 minit, dan sewaan anda mesti tamat sebelum kedai tutup. Halaman tempahan hanya menunjukkan masa yang kosong." }],
        },
        {
          q: "Adakah saya perlukan akaun?",
          blocks: [{ p: "Tidak. Kami hanya memerlukan nama, nombor telefon dan e-mel anda." }],
        },
        {
          q: "Berapa lama masa yang saya ada untuk membayar?",
          blocks: [
            {
              p: "{payMinutes} minit. Dron hanya ditahan untuk anda selepas bayaran anda berjaya. Jika dua orang membayar untuk dron terakhir yang sama, bayaran pertama menang, dan seorang lagi dipulangkan wang sepenuhnya secara automatik, kemudian diminta memilih masa lain.",
            },
          ],
        },
        {
          q: "Bolehkah saya datang terus tanpa menempah?",
          blocks: [
            {
              p: "Boleh, jika ada dron yang kosong. Imbas kod QR walk-in di kedai. Anda boleh membayar yuran sewa dengan kad atau secara tunai di kedai. Kad sentiasa diperlukan untuk deposit.",
            },
          ],
        },
      ],
    },
    {
      title: idc("Semakan ID dan siapa boleh menyewa", "Siapa boleh menyewa"),
      items: [
        {
          q: idc("Mengapa anda meminta semakan ID?", "Mengapa kakitangan menyemak ID saya?"),
          blocks: [
            {
              p: idc("Supaya dron hanya disewakan kepada orang sebenar yang boleh dipertanggungjawabkan ke atasnya. Ia ialah gambar MyKad atau pasport anda dan swafoto langsung, dilakukan pada telefon anda melalui penyedia pengesahan kami. Ia dibuat sebelum pembayaran, jadi anda tidak dicaj jika semakan tidak lulus. Jika anda rasa ia salah, hubungi kami.", "Supaya dron hanya disewakan kepada orang sebenar yang boleh dipertanggungjawabkan ke atasnya. Kakitangan menyemak MyKad atau pasport anda dengan tempahan anda apabila anda mengambil dron. Jika anda rasa mereka tersilap, hubungi kami."),
            },
          ],
        },
        {
          q: "Adakah saya perlu membawa ID saya?",
          blocks: [
            {
              p: idc("Ya. Bawa ID bergambar yang sama ke kedai. Kakitangan menyemaknya dengan tempahan anda, dan orang yang mengambil dron mestilah orang yang menempah. Dron tidak boleh dipinjamkan kepada orang lain. Jika ID tidak dapat ditunjukkan atau tidak sepadan, sewaan dipulangkan wang sepenuhnya.", "Ya. Bawa MyKad atau pasport anda ke kedai. Kakitangan menyemaknya dengan tempahan anda, dan orang yang mengambil dron mestilah orang yang menempah. Dron tidak boleh dipinjamkan kepada orang lain. Jika ID tidak dapat ditunjukkan atau tidak sepadan, sewaan dipulangkan wang sepenuhnya."),
            },
          ],
        },
        {
          q: "Berapakah umur minimum saya?",
          blocks: [{ p: "Sekurang-kurangnya 18 tahun." }],
        },
      ],
    },
    {
      title: "Deposit",
      items: [
        {
          q: "Apakah deposit itu?",
          blocks: [
            {
              p: "Tahanan yang boleh dipulangkan pada kad anda, bukan caj: {neo2Dep} untuk Neo 2 atau {neoDep} untuk Neo, ditambah {rcDep} jika anda menambah RC-N3 atau {goggDep} jika anda menambah goggles. Jumlah tepat ditunjukkan sebelum anda membayar. Tiada apa-apa diambil daripadanya kecuali sesuatu rosak, hilang atau terhutang.",
            },
          ],
        },
        {
          q: "Bilakah saya mendapatnya semula?",
          blocks: [
            {
              p: "Tahanan dilepaskan apabila dron dan alat kawalan dipulangkan dalam keadaan baik. Bank anda mungkin mengambil beberapa hari untuk menunjukkannya sebagai dilepaskan. Tahanan yang tidak digunakan juga dilepaskan secara automatik selepas kira-kira {holdDays} hari.",
            },
          ],
        },
        {
          q: "Tempahan saya meminta saya mengesahkan deposit. Apa yang perlu saya buat?",
          blocks: [
            {
              p: "Kadangkala bank anda memerlukan satu lagi kelulusan sebelum menahan deposit, contohnya dalam aplikasi perbankan anda. Halaman tempahan anda kemudian menunjukkan butang untuk mengesahkannya. Kedai tidak boleh menyerahkan dron selagi tahanan itu belum ada.",
            },
          ],
        },
        {
          q: "Bagaimana jika sesuatu rosak atau hilang?",
          blocks: [
            {
              ul: [
                "Kerosakan: kedai merekodkannya dengan gambar dan kami menyemaknya pada petang itu. Kos pembaikan ditolak daripada deposit anda, setakat jumlah yang ditahan, dan invois pembaikan dihantar kepada anda. Selebihnya dilepaskan.",
                "Hilang (diterbangkan di luar capaian, ke dalam air, atau tidak dipulangkan): kami menyimpan deposit yang ditahan bagi item itu.",
                "Deposit ialah jumlah paling banyak yang kami ambil untuk kerosakan atau kehilangan. Yuran lewat dan bateri tambahan dicaj secara berasingan.",
              ],
            },
            { p: "Lihat {link:terms} untuk butiran." },
          ],
        },
      ],
    },
    {
      title: "Menerbangkan dron",
      items: [
        {
          q: "Telefon sahaja, alat kawalan atau goggles: yang mana patut saya pilih?",
          blocks: [
            {
              ul: [
                "Telefon sahaja: anda terbang dengan telefon sendiri dan aplikasi DJI Fly. Paling murah, dan sesuai untuk penerbangan santai.",
                "Alat kawalan (RC-N3): alat kawalan sebenar tempat telefon anda diklipkan (anda masih memerlukan telefon). Jarak kawalan lebih jauh.",
                "Goggles N3 dengan Motion 3: anda terbang dengan melihat melalui goggles dan menggerakkan alat kawalan Motion 3. Tidak perlu telefon.",
              ],
            },
          ],
        },
        {
          q: "Bagaimana dengan angin dan hujan?",
          blocks: [
            {
              p: "Tempahan dalam talian disekat apabila ramalan angin di kedai lebih kuat daripada had dron: {neo2Wind} m/s untuk Neo 2 dan {neoWind} m/s untuk Neo. Jangan terbang semasa hujan, dan jangan terbang jika terasa tidak selamat, terutamanya di atas air atau berhampiran pantai. Jika kami terpaksa membatalkan kerana cuaca dan anda tidak dapat menempah semula, anda mendapat bayaran balik penuh.",
            },
          ],
        },
        {
          q: "Di mana saya boleh terbang?",
          blocks: [
            {
              p: "Patuhi undang-undang Malaysia dan peraturan Pihak Berkuasa Penerbangan Awam Malaysia (CAAM). Jauhi lapangan terbang dan kawasan larangan, pastikan dron dalam pandangan anda, dan jauhi orang ramai, kumpulan orang dan jalan raya. Lihat {link:terms}.",
            },
          ],
        },
      ],
    },
    {
      title: "Mengambil dan memulangkan",
      items: [
        {
          q: "Di mana dan bagaimana saya mengambil dron?",
          blocks: [
            {
              p: "Di kedai yang anda pilih. Tunjukkan kod QR tempahan dan ID bergambar anda. Kedai menyemak dron, bateri dan aksesori bersama anda dan mengambil gambar. Mereka berbuat demikian juga semasa pemulangan, dan gambar itu ialah rekod keadaannya.",
            },
          ],
        },
        {
          q: "Bagaimana jika saya lewat memulangkannya?",
          blocks: [
            {
              p: "Terdapat tempoh bertolak ansur {grace} minit. Selepas itu, yuran lewat sebanyak kadar satu jam (dron ditambah alat kawalan) dicaj untuk setiap jam atau sebahagian jam anda lewat. Ia dicaj pada kad yang anda gunakan untuk menempah, atau anda boleh membayarnya secara tunai di kedai.",
            },
          ],
        },
        {
          q: "Bagaimana jika bateri habis?",
          blocks: [{ p: "Tukar bateri yang telah digunakan dengan bateri yang dicas penuh di mana-mana kedai kami semasa sewaan anda, bukan hanya kedai tempat anda menyewa. Buka pautan tempahan anda, tekan Bateri habis? Tukar di mana-mana kedai, pilih kedai dan tunjukkan kod QR kepada kakitangan. Setiap pertukaran dicaj pada harga bateri, pada kad tersimpan anda atau secara tunai. Apabila masa tamat, anda masih perlu memulangkan dron dan semua bateri ke kedai tempat anda menyewa." }],
        },
      ],
    },
    {
      title: "Pembatalan, bayaran balik dan pembayaran",
      items: [
        {
          q: "Bolehkah saya membatalkan?",
          blocks: [
            {
              p: "Boleh. Batalkan sekurang-kurangnya {freeHours} jam sebelum masa mula anda dan anda mendapat balik seluruh yuran sewa. Jika lebih lewat daripada itu, yuran tidak dipulangkan. Untuk membatalkan, hubungi kami dengan nombor tempahan anda serta nama dan telefon yang anda gunakan semasa menempah.",
            },
          ],
        },
        {
          q: "Bilakah saya mendapat bayaran balik?",
          blocks: [{ p: "Kami memulakannya serta-merta, kembali ke kad yang anda gunakan untuk membayar. Bank anda mungkin mengambil masa 5 hingga 10 hari bekerja untuk menunjukkannya. Lihat {link:refunds}." }],
        },
        {
          q: "Adakah kad saya selamat?",
          blocks: [{ p: "Pembayaran kad dikendalikan oleh Stripe. Kami tidak pernah melihat atau menyimpan nombor kad anda." }],
        },
        {
          q: "Sesuatu caj nampak salah. Apa yang perlu saya buat?",
          blocks: [{ p: "Hubungi kami dalam masa 14 hari, sebelum meminta bank anda membatalkannya. Kami akan menyemak gambar semasa penyerahan dan pemulangan bersama anda dan membetulkannya jika kami yang tersilap." }],
        },
        {
          q: "Bolehkah saya menggunakan laman ini dalam Bahasa Melayu atau Cina?",
          blocks: [{ p: "Boleh. Gunakan suis EN, BM dan 中 di bahagian atas halaman." }],
        },
      ],
    },
  ],
  stuck: "Tidak menjumpai jawapan anda? Lihat {link:contact}.",
};

export const faqZh: FaqPage = {
  title: "常见问题",
  description: "关于预订、身份验证、信用卡押金、飞行、取机与还机，以及退款的简短解答。",
  intro: "这里是客户最常问的问题的简短解答。完整规则请见{link:terms}和{link:refunds}。",
  sections: [
    {
      title: "预订与价格",
      items: [
        {
          q: "如何预订无人机？",
          blocks: [
            {
              p: idc("打开预订页面，选择门店（在地图上选，或点“离我最近”），选择无人机、操控方式和电池，再选择日期和时间。填写姓名、手机号码和电子邮箱，完成简单的身份验证，然后付款。之后您会得到一个带二维码的预订页面，到店时出示即可。", "打开预订页面，选择门店（在地图上选，或点“离我最近”），选择无人机、操控方式和电池，再选择日期和时间。填写姓名、手机号码和电子邮箱，然后付款。之后您会得到一个带二维码的预订页面，到店时出示即可。"),
            },
          ],
        },
        {
          q: "费用是多少？",
          blocks: [
            {
              ul: [
                "DJI Neo 2 每小时 {neo2Rate}，DJI Neo 每小时 {neoRate}。",
                "RC-N3 遥控器每小时加收 {rcRate}。Goggles N3 搭配 Motion 3 体感控制器每小时加收 {goggRate}。只用自己的手机飞行不加收。",
                "您选择的电池方案只加收一次。",
              ],
            },
            { p: "付款前预订页面上显示的总额就是您要付的金额。此外，信用卡上会冻结一笔可退还的押金（见下方“押金”）。" },
          ],
        },
        {
          q: "最长可以租多久？",
          blocks: [{ p: "1 至 {maxHours} 小时。开始时间每 30 分钟一档，租期必须在门店关门前结束。预订页面只显示空闲的时间。" }],
        },
        {
          q: "需要注册账户吗？",
          blocks: [{ p: "不需要。我们只需要您的姓名、手机号码和电子邮箱。" }],
        },
        {
          q: "我有多长时间付款？",
          blocks: [
            {
              p: "{payMinutes} 分钟。只有付款成功后，无人机才会为您保留。如果两个人为同一架最后一台无人机付款，先付款者获得，另一人会自动全额退款，并被请求选择其他时间。",
            },
          ],
        },
        {
          q: "可以不预订直接到店租吗？",
          blocks: [
            {
              p: "可以，只要有空闲的无人机。在门店扫描现场租借二维码。租金可以刷卡，也可以在店里付现金。押金始终需要用信用卡。",
            },
          ],
        },
      ],
    },
    {
      title: idc("身份验证与租借资格", "租借资格"),
      items: [
        {
          q: idc("为什么要做身份验证？", "为什么店员要核对我的证件？"),
          blocks: [
            {
              p: idc("这样无人机只会租给可以为其负责的真实本人。验证内容是您的 MyKad 或护照照片加一张现场自拍，通过我们的验证服务商在您的手机上完成。验证在付款之前进行，所以未通过时不会向您收费。如果您认为结果有误，请联系我们。", "这样无人机只会租给可以为其负责的真实本人。取机时，店员会对照您的预订核对您的 MyKad 或护照。如果您认为他们弄错了，请联系我们。"),
            },
          ],
        },
        {
          q: "取机时需要带证件吗？",
          blocks: [
            {
              p: idc("需要。请带上同一份带照片的证件到门店。店员会与您的预订核对，取机的人必须是预订人本人，无人机不能借给别人。如果无法出示证件或证件不符，租金将全额退还。", "需要。请带上您的 MyKad 或护照到门店。店员会与您的预订核对，取机的人必须是预订人本人，无人机不能借给别人。如果无法出示证件或证件不符，租金将全额退还。"),
            },
          ],
        },
        {
          q: "需要满几岁？",
          blocks: [{ p: "至少 18 岁。" }],
        },
      ],
    },
    {
      title: "押金",
      items: [
        {
          q: "押金是什么？",
          blocks: [
            {
              p: "是信用卡上可退还的冻结金额，不是扣款：Neo 2 为 {neo2Dep}，Neo 为 {neoDep}，加 RC-N3 另加 {rcDep}，加 Goggles 另加 {goggDep}。具体金额在付款前显示。除非有损坏、遗失或欠款，否则不会从中扣任何钱。",
            },
          ],
        },
        {
          q: "什么时候退还？",
          blocks: [
            {
              p: "无人机和遥控器完好归还后，冻结即被解除。您的银行可能需要几天才会显示已解除。未使用的冻结大约 {holdDays} 天后也会自动解除。",
            },
          ],
        },
        {
          q: "我的预订要求我确认押金，该怎么办？",
          blocks: [
            {
              p: "有时银行在冻结押金之前需要您再确认一次，例如在银行 App 中。这时预订页面会出现一个确认按钮。在冻结生效之前，门店不能交出无人机。",
            },
          ],
        },
        {
          q: "如果损坏或遗失了怎么办？",
          blocks: [
            {
              ul: [
                "损坏：门店会拍照记录，我们在当晚审核。维修费用从您的押金中扣除，最多以冻结金额为限，维修发票会发送给您，其余解除冻结。",
                "遗失（飞出可控范围、掉入水中或未归还）：我们会扣下该物品对应的押金。",
                "押金是我们因损坏或遗失所收取的上限。逾期费和额外电池费另行收取。",
              ],
            },
            { p: "详情请见{link:terms}。" },
          ],
        },
      ],
    },
    {
      title: "飞行",
      items: [
        {
          q: "只用手机、遥控器还是 Goggles：该选哪个？",
          blocks: [
            {
              ul: [
                "只用手机：用您自己的手机和 DJI Fly App 飞行。最便宜，适合休闲飞行。",
                "遥控器（RC-N3）：把手机夹在上面的正规遥控器（仍需要您的手机）。控制距离更远。",
                "Goggles N3 搭配 Motion 3：通过眼镜观看并移动 Motion 3 体感控制器来飞行，不需要手机。",
              ],
            },
          ],
        },
        {
          q: "风和雨怎么办？",
          blocks: [
            {
              p: "当门店的预报风速超过无人机的上限时，网上预订会被停止：Neo 2 为 {neo2Wind} 米/秒，Neo 为 {neoWind} 米/秒。下雨时不要飞行；如果觉得不安全也不要飞，尤其是在水面上或海滩附近。如果因天气我们不得不取消、而您无法改期，将全额退款。",
            },
          ],
        },
        {
          q: "可以在哪里飞？",
          blocks: [
            {
              p: "请遵守马来西亚法律和马来西亚民航局（CAAM）的规定。远离机场和禁飞区，让无人机保持在视线内，并避开人群、人多的地方和马路。请见{link:terms}。",
            },
          ],
        },
      ],
    },
    {
      title: "取机与还机",
      items: [
        {
          q: "在哪里、怎样取机？",
          blocks: [
            {
              p: "在您选择的门店。出示预订二维码和带照片的证件。店员会与您一起检查无人机、电池和配件并拍照。还机时也会这样做，这些照片就是状况的记录。",
            },
          ],
        },
        {
          q: "如果还机晚了怎么办？",
          blocks: [
            {
              p: "有 {grace} 分钟的宽限期。之后，每逾期一小时或不足一小时，收取一小时的费率（无人机加遥控器）作为逾期费。费用从您预订时用的卡中扣除，也可以在店里付现金。",
            },
          ],
        },
        {
          q: "电池没电了怎么办？",
          blocks: [{ p: "租期内可以在我们任何一家门店把用过的电池换成充满电的，不只是租机的那家。打开您的预订链接，点“电池用完了？可在任何门店更换”，选择门店并向店员出示二维码。每次更换按电池价格收费，从您保存的卡中扣除或付现金。时间到后，仍需把无人机和全部电池归还到您租机的门店。" }],
        },
      ],
    },
    {
      title: "取消、退款与付款",
      items: [
        {
          q: "可以取消吗？",
          blocks: [
            {
              p: "可以。在开始时间至少 {freeHours} 小时前取消，租金全额退还。晚于此则不退租金。取消请联系我们，并提供预订编号以及预订时使用的姓名和手机号码。",
            },
          ],
        },
        {
          q: "什么时候能收到退款？",
          blocks: [{ p: "我们会立即发起退款，退回您付款时使用的信用卡。您的银行可能需要 5 至 10 个工作日才会显示。请见{link:refunds}。" }],
        },
        {
          q: "我的卡安全吗？",
          blocks: [{ p: "银行卡付款由 Stripe 处理。我们从不查看或保存您的卡号。" }],
        },
        {
          q: "有一笔费用看起来不对，怎么办？",
          blocks: [{ p: "请在 14 天内联系我们，并先不要让银行撤销交易。我们会和您一起查看取机与还机时的照片，如果是我们弄错了会予以更正。" }],
        },
        {
          q: "网站有马来文或中文吗？",
          blocks: [{ p: "有。使用页面顶部的 EN、BM、中 切换。" }],
        },
      ],
    },
  ],
  stuck: "没有找到答案？请见{link:contact}。",
};
