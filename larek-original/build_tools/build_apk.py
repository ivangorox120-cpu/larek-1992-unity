#!/usr/bin/env python3
"""100% self-contained builder & v1+v2 APK signer for Ларёк 1992 (com.larek.game + com.larek.gam2)."""
import argparse, base64, hashlib, os, struct, zipfile
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.serialization import pkcs7

priv_key = key = cert_der = cert_obj = cert = pub_key_der = pub_der = pub_spki_der = None

def make_v1_signatures(entries_dict):
    mf_lines = [
        "Manifest-Version: 1.0",
        "Created-By: 1.0 (Android)",
        ""
    ]
    sf_sections = []
    for name in sorted(entries_dict.keys()):
        if name.startswith("META-INF/") and (name.endswith(".SF") or name.endswith(".RSA") or name == "META-INF/MANIFEST.MF"):
            continue
        raw = entries_dict[name]
        d_mf = base64.b64encode(hashlib.sha256(raw).digest()).decode("ascii")
        sec = f"Name: {name}\r\nSHA-256-Digest: {d_mf}\r\n\r\n"
        mf_lines.append(sec.rstrip("\r\n"))
        mf_lines.append("")
        d_sf = base64.b64encode(hashlib.sha256(sec.encode("utf-8")).digest()).decode("ascii")
        sf_sections.append(f"Name: {name}\r\nSHA-256-Digest: {d_sf}\r\n\r\n")

    mf_bytes = "\r\n".join(mf_lines).encode("utf-8")
    main_sf_digest = base64.b64encode(hashlib.sha256(mf_bytes).digest()).decode("ascii")
    sf_header = (
        "Signature-Version: 1.0\r\n"
        "Created-By: 1.0 (Android)\r\n"
        f"SHA-256-Digest-Manifest: {main_sf_digest}\r\n"
        "X-Android-APK-Signed: 2\r\n\r\n"
    )
    sf_bytes = (sf_header + "".join(sf_sections)).encode("utf-8")
    rsa_bytes = (
        pkcs7.PKCS7SignatureBuilder()
        .set_data(sf_bytes)
        .add_signer(cert, priv_key, hashes.SHA256())
        .sign(serialization.Encoding.DER, [pkcs7.PKCS7Options.DetachedSignature, pkcs7.PKCS7Options.Binary])
    )
    return mf_bytes, sf_bytes, rsa_bytes

def compute_v2_digest(sections):
    chunk_digests = []
    CHUNK_SIZE = 1024 * 1024
    for sec in sections:
        pos = 0
        n = len(sec)
        while pos < n:
            chunk = sec[pos:pos + CHUNK_SIZE]
            pos += CHUNK_SIZE
            h = hashlib.sha256()
            h.update(b"\xa5")
            h.update(struct.pack("<I", len(chunk)))
            h.update(chunk)
            chunk_digests.append(h.digest())
    h_top = hashlib.sha256()
    h_top.update(b"\x5a")
    h_top.update(struct.pack("<I", len(chunk_digests)))
    for d in chunk_digests:
        h_top.update(d)
    return h_top.digest()

def lp_bytes(b):
    return struct.pack("<I", len(b)) + b

def build_v2_block(digest_bytes):
    ALG_ID = 0x0103
    digest_entry = lp_bytes(struct.pack("<I", ALG_ID) + lp_bytes(digest_bytes))
    digests_seq = lp_bytes(digest_entry)
    certs_seq = lp_bytes(lp_bytes(cert_der))
    attrs_seq = lp_bytes(b"")
    signed_data = digests_seq + certs_seq + attrs_seq
    sig_raw = priv_key.sign(signed_data, padding.PKCS1v15(), hashes.SHA256())
    sig_entry = lp_bytes(struct.pack("<I", ALG_ID) + lp_bytes(sig_raw))
    sigs_seq = lp_bytes(sig_entry)
    signer = lp_bytes(lp_bytes(signed_data) + sigs_seq + lp_bytes(pub_spki_der))
    signers_seq = lp_bytes(signer)
    v2_pair = struct.pack("<Q", 4 + len(signers_seq)) + struct.pack("<I", 0x7109871a) + signers_seq

    base_len = 8 + len(v2_pair) + 8 + 16
    rem = (4096 - ((base_len + 12) % 4096)) % 4096
    pad_val = b"\x00" * rem
    pad_pair = struct.pack("<Q", 4 + len(pad_val)) + struct.pack("<I", 0x42726577) + pad_val
    pairs = v2_pair + pad_pair
    size_of_block = len(pairs) + 8 + 16
    return struct.pack("<Q", size_of_block) + pairs + struct.pack("<Q", size_of_block) + b"APK Sig Block 42"

def verify_apk(apk_path):
    with open(apk_path, "rb") as f:
        data = f.read()
    eocd_off = data.rfind(b"PK\x05\x06")
    cd_size, cd_off = struct.unpack_from("<II", data, eocd_off + 12)
    block_size_2 = struct.unpack_from("<Q", data, cd_off - 24)[0]
    block_start = cd_off - 8 - block_size_2
    block_size_1 = struct.unpack_from("<Q", data, block_start)[0]
    assert block_size_1 == block_size_2 == 4088, f"Bad block size {block_size_1}"
    pair_len = struct.unpack_from("<Q", data, block_start + 8)[0]
    pair_id = struct.unpack_from("<I", data, block_start + 16)[0]
    assert pair_id == 0x7109871a and pair_len == 1416, f"Bad pair {hex(pair_id)} len={pair_len}"
    val = data[block_start+20:block_start+8+pair_len]
    sd_len = struct.unpack_from("<I", val, 8)[0]
    assert sd_len == 830, f"Bad sd_len {sd_len}"
    sd = val[12:12+sd_len]
    sigs_off = 12 + sd_len
    sigs_len = struct.unpack_from("<I", val, sigs_off)[0]
    sig_entry_len = struct.unpack_from("<I", val, sigs_off + 4)[0]
    alg_id = struct.unpack_from("<I", val, sigs_off + 8)[0]
    sig_len = struct.unpack_from("<I", val, sigs_off + 12)[0]
    sig_bytes = val[sigs_off + 16 : sigs_off + 16 + sig_len]
    priv_key.public_key().verify(sig_bytes, sd, padding.PKCS1v15(), hashes.SHA256())
    eocd_copy = bytearray(data[eocd_off:])
    struct.pack_into("<I", eocd_copy, 16, block_start)
    exp_digest = compute_v2_digest([data[:block_start], data[cd_off:eocd_off], bytes(eocd_copy)])
    assert exp_digest in sd, "Digest mismatch!"
    print(f"VERIFIED {apk_path} (size={len(data)}, serial={cert.serial_number}) successfully!")


def load_keys(key_path, cert_path):
    global priv_key, key, cert_der, cert_obj, cert, pub_key_der, pub_der, pub_spki_der
    priv_key = key = serialization.load_pem_private_key(open(key_path, 'rb').read(), password=None)
    cert_der = open(cert_path, 'rb').read()
    cert_obj = cert = x509.load_der_x509_certificate(cert_der)
    pub_key_der = pub_der = pub_spki_der = cert_obj.public_key().public_bytes(
        serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo
    )

def build_signed_apk(base_apk_path, out_apk_path, src_dir, is_parallel=False):
    file_overrides = {}
    for root, _, files in os.walk(src_dir):
        for fn in files:
            full = os.path.join(root, fn)
            rel = os.path.relpath(full, src_dir).replace('\\', '/')
            data = open(full, 'rb').read()
            apk_rel = rel if rel.startswith('assets/') else 'assets/' + rel
            file_overrides[apk_rel] = data
            if rel.startswith(('tex/', 'models/', 'audio/')):
                file_overrides['assets/assets/' + rel] = data

    tmp_zip = out_apk_path + ".tmp.zip"
    entries, infos, par_overrides = {}, [], {}
    if is_parallel:
        with zipfile.ZipFile(base_apk_path, "r") as zpar:
            for pname in ("AndroidManifest.xml", "resources.arsc"):
                par_overrides[pname] = zpar.read(pname).replace(
                    "com.larek.game".encode("utf-16le"), "com.larek.gam2".encode("utf-16le")
                )
    with zipfile.ZipFile(base_apk_path, "r") as zin:
        for info in zin.infolist():
            if info.filename in ("META-INF/MANIFEST.MF", "META-INF/CERT.SF", "META-INF/CERT.RSA"):
                continue
            data = par_overrides.get(info.filename, file_overrides.get(info.filename, zin.read(info.filename)))
            entries[info.filename] = data
            infos.append(info)
        for fname, data in file_overrides.items():
            if fname not in entries:
                entries[fname] = data
                ni = zipfile.ZipInfo(fname, date_time=(1981, 1, 1, 1, 1, 2))
                ni.compress_type = zipfile.ZIP_DEFLATED
                ni.external_attr = 0
                infos.append(ni)

    mf_b, sf_b, rsa_b = make_v1_signatures(entries)
    with zipfile.ZipFile(tmp_zip, "w") as zout:
        for info in infos:
            ni = zipfile.ZipInfo(info.filename, date_time=(1981, 1, 1, 1, 1, 2))
            ni.compress_type = zipfile.ZIP_STORED if info.filename.endswith((".mp3", ".mp4", ".bin", ".woff2", ".ogg", ".wav", ".arsc")) else info.compress_type
            ni.create_system = 0
            ni.external_attr = info.external_attr
            if ni.compress_type == zipfile.ZIP_STORED:
                cur_off = zout.fp.tell()
                header_len = 30 + len(ni.filename.encode("utf-8"))
                pad_needed = (4 - ((cur_off + header_len) % 4)) % 4
                if pad_needed:
                    ni.extra = b"\x00" * pad_needed
            zout.writestr(ni, entries[info.filename])
        for sname, sdata in [("META-INF/MANIFEST.MF", mf_b), ("META-INF/CERT.SF", sf_b), ("META-INF/CERT.RSA", rsa_b)]:
            ni = zipfile.ZipInfo(sname, date_time=(1981, 1, 1, 1, 1, 2))
            ni.compress_type = zipfile.ZIP_DEFLATED
            zout.writestr(ni, sdata)

    raw = open(tmp_zip, "rb").read()
    eocd_pos = raw.rfind(b"PK\x05\x06")
    cd_size, cd_off = struct.unpack_from("<II", raw, eocd_pos + 12)
    before_cd, cd_bytes, eocd_bytes = raw[:cd_off], raw[cd_off:eocd_pos], bytearray(raw[eocd_pos:])
    v2_block = build_v2_block(compute_v2_digest([before_cd, cd_bytes, bytes(eocd_bytes)]))
    struct.pack_into("<I", eocd_bytes, 16, cd_off + len(v2_block))
    with open(out_apk_path, "wb") as f:
        f.write(before_cd); f.write(v2_block); f.write(cd_bytes); f.write(eocd_bytes)
    os.remove(tmp_zip)
    verify_apk(out_apk_path)

def main():
    ap = argparse.ArgumentParser(description="Build & sign Ларёк 1992 APKs")
    ap.add_argument('--base', required=True, help='Path to base APK (e.g. apk/larek-build232.apk)')
    ap.add_argument('--src', required=True, help='Path to source/ directory')
    ap.add_argument('--key', required=True, help='Path to larek_release_key.pem')
    ap.add_argument('--cert', required=True, help='Path to larek_release_cert.der')
    ap.add_argument('--build', required=True, help='Build number (e.g. 233)')
    ap.add_argument('--out', default='out', help='Output directory')
    args = ap.parse_args()
    load_keys(args.key, args.cert)
    os.makedirs(args.out, exist_ok=True)
    build_signed_apk(args.base, os.path.join(args.out, f'larek-build{args.build}.apk'), args.src, False)
    build_signed_apk(args.base, os.path.join(args.out, f'larek-build{args.build}-parallel.apk'), args.src, True)

if __name__ == '__main__':
    main()
