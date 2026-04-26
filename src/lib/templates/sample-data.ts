export const sampleInvoiceData = {
  store: {
    name: "Beam Shop",
    email: "hello@beamshop.com",
    phone: "+965 555 1234",
    address: "Salem Mubarak St, Salmiya, Kuwait",
    logo: "https://placehold.co/120x40/0F172A/FFFFFF?text=BEAM",
  },
  order: {
    number: "#7264",
    date: "Apr 26, 2026",
    status: "Completed",
    currency: "KWD",
    notes: "Leave at door, no signature needed",
    customer: { name: "Mohammed Alaskar", email: "m7md.alaskar@gmail.com", phone: "0540914183" },
    billing: { first_name: "Mohammed", last_name: "Alaskar", address_1: "House, Riyadh-Alkharj, Prince Faisal Bin Bandar", address_2: "", city: "Riyadh", state: "", postcode: "12345", country: "SA" },
    shipping: { first_name: "Mohammed", last_name: "Alaskar", address_1: "House, Riyadh-Alkharj, Prince Faisal Bin Bandar", address_2: "", city: "Riyadh", state: "", postcode: "12345", country: "SA" },
    items: [
      { name: "Midi set - S", sku: "1022", quantity: 1, price: "44.00", total: "44.00", image: "https://placehold.co/60x60/F8FAFC/64748B?text=Midi" },
      { name: "Linen wrap - M", sku: "1045", quantity: 2, price: "32.00", total: "64.00", image: "https://placehold.co/60x60/F8FAFC/64748B?text=Linen" },
    ],
    totals: { subtotal: "108.00", shipping: "8.50", tax: "0.00", discount: "0.00", total: "116.50" },
    payment: { method: "MyFatoorah - Cards", transaction_id: "TX-882164" },
  },
};

export type SampleData = typeof sampleInvoiceData;