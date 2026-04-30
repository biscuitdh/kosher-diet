locals {
  firebase_dns_records = {
    for record in var.firebase_dns_records :
    "${upper(record.type)}:${record.name}:${record.content}" => record
  }
}

resource "cloudflare_dns_record" "firebase" {
  for_each = local.firebase_dns_records

  zone_id = var.cloudflare_zone_id
  name    = each.value.name
  type    = upper(each.value.type)
  content = each.value.content
  ttl     = each.value.ttl
  proxied = each.value.proxied
  comment = "Firebase Hosting for ${var.domain}"
}
