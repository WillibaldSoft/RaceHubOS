// Increase speech density with a smooth limiter instead of clipping PCM peaks.
// Gain=1 preserves Piper's original WAV. Only standard 16-bit PCM is processed.
export function amplifyVoice(wav, gain = 2) {
  if (!Number.isFinite(gain) || gain < 1 || gain > 4) throw new Error('Invalid voice gain');
  if (gain === 1) return wav;
  const output = Buffer.from(wav);
  if (output.toString('ascii', 0, 4) !== 'RIFF' || output.toString('ascii', 8, 12) !== 'WAVE')
    throw new Error('Invalid WAV');
  let pcm = false;
  for (let offset = 12; offset + 8 <= output.length;) {
    const size = output.readUInt32LE(offset + 4),
      start = offset + 8;
    if (start + size > output.length) throw new Error('Truncated WAV');
    const type = output.toString('ascii', offset, offset + 4);
    if (type === 'fmt ' && size >= 16) pcm = output.readUInt16LE(start) === 1 && output.readUInt16LE(start + 14) === 16;
    if (type === 'data') {
      if (!pcm || size % 2) throw new Error('Unsupported WAV format');
      for (let i = start; i < start + size; i += 2) {
        const sample = output.readInt16LE(i) / 32768;
        output.writeInt16LE(Math.round(0.97 * Math.tanh(sample * gain) * 32767), i);
      }
      return output;
    }
    offset = start + size + (size % 2);
  }
  throw new Error('WAV has no audio');
}
