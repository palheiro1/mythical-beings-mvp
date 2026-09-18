#!/usr/bin/env python3
"""Rebuild web artwork from the colour-profiled print originals in Git.

Requires Pillow with ImageCms (LittleCMS). Run from any directory with:
    python3 scripts/prepare-card-colours.py
The source JPEGs stay in Git history and are never added to the public build.
"""

import hashlib
import io
import json
import subprocess
from pathlib import Path

from PIL import Image, ImageChops, ImageCms, ImageStat

ROOT = Path(__file__).resolve().parent.parent
SOURCE_COMMIT = 'd143d3b6e08128ba89e1b01c9f0402bbf3956edb'
OUTPUT_PROFILE = ImageCms.ImageCmsProfile(ImageCms.createProfile('sRGB'))
TRANSFORMS = {}


def art_error(image, reference, smooth=False):
    width, height = image.size
    crop = (round(width * .21), round(height * .28),
            round(width * .79), round(height * .62))
    sample, expected = image.crop(crop), reference.crop(crop)
    if smooth:
        # Separate colour shifts from normal high-frequency codec differences.
        sample = sample.resize((32, 32), Image.Resampling.BOX)
        expected = expected.resize((32, 32), Image.Resampling.BOX)
    difference = ImageChops.difference(sample, expected)
    return round(sum(ImageStat.Stat(difference).mean) / 3, 3)


def main():
    cards = json.loads((ROOT / 'src/assets/creatures.json').read_text())
    cards += json.loads((ROOT / 'src/assets/knowledges.json').read_text())
    report = []
    for card in cards:
        # Lafaic was obtained separately from an already colour-managed source.
        if card['image'] == '/images/beings/lafaic.webp':
            continue
        relative = 'public' + card['image']
        source_path = relative.replace('.webp', '.jpg')
        source_bytes = subprocess.check_output(
            ['git', 'show', f'{SOURCE_COMMIT}:{source_path}'], cwd=ROOT)
        source = Image.open(io.BytesIO(source_bytes))
        icc = source.info.get('icc_profile')
        if source.mode != 'CMYK' or not icc:
            raise ValueError(f'{source_path}: expected a profiled CMYK original')
        profile_id = hashlib.sha256(icc).hexdigest()
        if profile_id not in TRANSFORMS:
            profile = ImageCms.ImageCmsProfile(io.BytesIO(icc))
            TRANSFORMS[profile_id] = ImageCms.buildTransform(
                profile, OUTPUT_PROFILE, 'CMYK', 'RGB',
                renderingIntent=ImageCms.Intent.PERCEPTUAL)
        rgb = ImageCms.applyTransform(source, TRANSFORMS[profile_id])
        for width, quality in [(720, 88), (360, 84)]:
            destination = ROOT / (relative if width == 720 else
                                  relative.replace('.webp', '-360.webp'))
            old_bytes = destination.stat().st_size
            before = Image.open(destination).convert('RGB')
            resized = rgb.resize((width, round(rgb.height * width / rgb.width)),
                                 Image.Resampling.LANCZOS)
            before_error = art_error(before, resized)
            encoded = io.BytesIO()
            resized.save(encoded, 'WEBP', quality=quality, method=6,
                         icc_profile=OUTPUT_PROFILE.tobytes())
            with Image.open(io.BytesIO(encoded.getvalue())) as result:
                if not result.info.get('icc_profile') or result.size != resized.size:
                    raise ValueError(f'{destination}: missing profile or wrong size')
                after_error = art_error(result.convert('RGB'), resized)
                smooth_error = art_error(result.convert('RGB'), resized, smooth=True)
            if smooth_error > 2:
                raise ValueError(f'{destination}: excessive encoding colour error')
            destination.write_bytes(encoded.getvalue())
            report.append({'card': card['name'], 'asset': str(destination.relative_to(ROOT)),
                           'width': width, 'sourceSHA256': hashlib.sha256(source_bytes).hexdigest(),
                           'bytesBefore': old_bytes, 'bytesAfter': destination.stat().st_size,
                           'meanAbsoluteRGBErrorBefore': before_error,
                           'meanAbsoluteRGBErrorAfter': after_error,
                           'smoothedRGBErrorAfter': smooth_error})
    output = ROOT / 'artifacts/colour-fix/conversion.json'
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps({'sourceCommit': SOURCE_COMMIT, 'profile': 'sRGB',
                                 'renderingIntent': 'perceptual', 'assets': report}, indent=2))
    print(json.dumps({'convertedCards': len(report) // 2, 'responsiveAssets': len(report),
                      'bytesBefore': sum(x['bytesBefore'] for x in report),
                      'bytesAfter': sum(x['bytesAfter'] for x in report),
                      'maxColourErrorAfter': max(x['meanAbsoluteRGBErrorAfter'] for x in report)}))


if __name__ == '__main__':
    main()
