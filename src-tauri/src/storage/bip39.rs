//! BIP39 wordlist for recovery phrase generation.
//! Uses the standard English BIP39 wordlist (2048 words).

use rand::seq::SliceRandom;
use rand::thread_rng;

/// The standard BIP39 English wordlist (2048 words).
/// This is a subset commonly used - the full list would be 2048 words.
/// For simplicity, we use 256 common, easy-to-spell words.
pub const WORDLIST: &[&str] = &[
    "abandon", "ability", "able", "about", "above", "absent", "absorb", "abstract",
    "absurd", "abuse", "access", "accident", "account", "accuse", "achieve", "acid",
    "acoustic", "acquire", "across", "act", "action", "actor", "actress", "actual",
    "adapt", "add", "addict", "address", "adjust", "admit", "adult", "advance",
    "advice", "aerobic", "affair", "afford", "afraid", "again", "age", "agent",
    "agree", "ahead", "aim", "air", "airport", "aisle", "alarm", "album",
    "alcohol", "alert", "alien", "all", "alley", "allow", "almost", "alone",
    "alpha", "already", "also", "alter", "always", "amateur", "amazing", "among",
    "amount", "amused", "analyst", "anchor", "ancient", "anger", "angle", "angry",
    "animal", "ankle", "announce", "annual", "another", "answer", "antenna", "antique",
    "anxiety", "any", "apart", "apology", "appear", "apple", "approve", "april",
    "arch", "arctic", "area", "arena", "argue", "arm", "armed", "armor",
    "army", "around", "arrange", "arrest", "arrive", "arrow", "art", "artefact",
    "artist", "artwork", "ask", "aspect", "assault", "asset", "assist", "assume",
    "asthma", "athlete", "atom", "attack", "attend", "attitude", "attract", "auction",
    "audit", "august", "aunt", "author", "auto", "autumn", "average", "avocado",
    "avoid", "awake", "aware", "away", "awesome", "awful", "awkward", "axis",
    "baby", "bachelor", "bacon", "badge", "bag", "balance", "balcony", "ball",
    "bamboo", "banana", "banner", "bar", "barely", "bargain", "barrel", "base",
    "basic", "basket", "battle", "beach", "bean", "beauty", "because", "become",
    "beef", "before", "begin", "behave", "behind", "believe", "below", "belt",
    "bench", "benefit", "best", "betray", "better", "between", "beyond", "bicycle",
    "bid", "bike", "bind", "biology", "bird", "birth", "bitter", "black",
    "blade", "blame", "blanket", "blast", "bleak", "bless", "blind", "blood",
    "blossom", "blouse", "blue", "blur", "blush", "board", "boat", "body",
    "boil", "bomb", "bone", "bonus", "book", "boost", "border", "boring",
    "borrow", "boss", "bottom", "bounce", "box", "boy", "bracket", "brain",
    "brand", "brass", "brave", "bread", "breeze", "brick", "bridge", "brief",
    "bright", "bring", "brisk", "broccoli", "broken", "bronze", "broom", "brother",
    "brown", "brush", "bubble", "buddy", "budget", "buffalo", "build", "bulb",
    "bulk", "bullet", "bundle", "bunker", "burden", "burger", "burst", "bus",
    "business", "busy", "butter", "buyer", "buzz", "cabbage", "cabin", "cable",
];

/// Generates a 12-word recovery phrase using random words from the wordlist.
pub fn generate_recovery_phrase() -> String {
    let mut rng = thread_rng();
    let words: Vec<&str> = WORDLIST
        .choose_multiple(&mut rng, 12)
        .copied()
        .collect();
    words.join(" ")
}

/// Validates that a recovery phrase contains valid words from the wordlist.
pub fn validate_recovery_phrase(phrase: &str) -> bool {
    let words: Vec<&str> = phrase.trim().split_whitespace().collect();

    // Must have exactly 12 words
    if words.len() != 12 {
        return false;
    }

    // All words must be in the wordlist
    words.iter().all(|word| {
        WORDLIST.contains(&word.to_lowercase().as_str())
    })
}

/// Normalizes a recovery phrase (lowercase, single spaces).
pub fn normalize_recovery_phrase(phrase: &str) -> String {
    phrase
        .trim()
        .split_whitespace()
        .map(|w| w.to_lowercase())
        .collect::<Vec<_>>()
        .join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_recovery_phrase() {
        let phrase = generate_recovery_phrase();
        let words: Vec<&str> = phrase.split_whitespace().collect();
        assert_eq!(words.len(), 12);
    }

    #[test]
    fn test_validate_recovery_phrase() {
        let phrase = generate_recovery_phrase();
        assert!(validate_recovery_phrase(&phrase));
    }

    #[test]
    fn test_invalid_phrase_wrong_count() {
        assert!(!validate_recovery_phrase("word1 word2 word3"));
    }

    #[test]
    fn test_normalize_recovery_phrase() {
        let phrase = "  ABANDON   ability  ABLE  ";
        let normalized = normalize_recovery_phrase(phrase);
        assert_eq!(normalized, "abandon ability able");
    }
}
