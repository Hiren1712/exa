output "instance_public_ip" {
  description = "Public IP used for SSH bootstrap. Application traffic should use Cloudflare Tunnel."
  value       = oci_core_instance.exa.public_ip
}

output "instance_ocid" {
  description = "OCID of the created compute instance."
  value       = oci_core_instance.exa.id
}
