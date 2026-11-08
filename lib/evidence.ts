// The seller's own evidence checklist on the case card, by dispute reason.
// Item not received needs proof of delivery; not as described needs the listing and photos.
// The ticks stay in the browser and are never sent to PayPal.
export function evidenceItems(reason: string): string[] {
  switch (reason) {
    case "INR":
      return ["Tracking number on the order in PayPal", "Carrier page showing delivered, with the delivery date", "Delivery address on the carrier page matches the order"];
    case "UNAUTHORISED":
      return ["Tracking number for the shipment", "Shipment date within 2 days of PayPal's notice", "Shipped to the address on the order"];
    case "SNAD":
      return ["Listing photos (as shown to the buyer)", "Parcel photos (the item received)", "Short note on why the item matches the listing"];
    default:
      return ["Messages or documents that support your side", "Short note on what happened"];
  }
}
