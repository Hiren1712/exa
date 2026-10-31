variable "oci_profile" {
  description = "Profile name from the local OCI CLI config file."
  type        = string
  default     = "DEFAULT"
}

variable "compartment_ocid" {
  description = "OCI compartment OCID where the network and VM will be created."
  type        = string
}

variable "ssh_source_cidr" {
  description = "Your public IPv4 CIDR allowed to SSH to the VM, e.g. 203.0.113.10/32."
  type        = string
}

variable "ssh_authorized_key" {
  description = "Your SSH public key (never the private key)."
  type        = string
}

variable "instance_name" {
  description = "Name assigned to the OCI compute instance."
  type        = string
  default     = "exa-free-vm"
}

variable "ocpus" {
  description = "Ampere A1 OCPUs; keep within the Always Free monthly allowance."
  type        = number
  default     = 2

  validation {
    condition     = var.ocpus >= 1 && var.ocpus <= 4
    error_message = "ocpus must be between 1 and 4 to stay within the A1 Always Free monthly allowance."
  }
}

variable "memory_in_gbs" {
  description = "Ampere A1 memory; keep within the Always Free monthly allowance."
  type        = number
  default     = 12

  validation {
    condition     = var.memory_in_gbs >= 6 && var.memory_in_gbs <= 24
    error_message = "memory_in_gbs must be between 6 and 24 to stay within the A1 Always Free monthly allowance."
  }
}

variable "boot_volume_size_in_gbs" {
  description = "Boot volume size in GiB. Keep total OCI block volumes within Always Free quota."
  type        = number
  default     = 100

  validation {
    condition     = var.boot_volume_size_in_gbs >= 50 && var.boot_volume_size_in_gbs <= 200
    error_message = "boot_volume_size_in_gbs must be between 50 and 200 GiB; total block storage across the tenancy must remain within the free quota."
  }
}
