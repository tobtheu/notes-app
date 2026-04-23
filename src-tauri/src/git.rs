use git2::{Repository};
use std::path::Path;

/// Ensures that a Git repository exists at the given path.
/// If it doesn't exist, it initializes a new one.
pub fn ensure_repo(path: &Path) -> Result<Repository, git2::Error> {
    match Repository::open(path) {
        Ok(repo) => Ok(repo),
        Err(_) => {
            Repository::init(path)
        }
    }
}

/// Adds or updates the "origin" remote URL for the repository.
pub fn add_remote(repo_path: &Path, remote_url: &str) -> Result<(), git2::Error> {
    let repo = Repository::open(repo_path)?;
    
    match repo.find_remote("origin") {
        Ok(_) => {
            repo.remote_set_url("origin", remote_url)?;
        }
        Err(_) => {
            repo.remote("origin", remote_url)?;
        }
    }
    
    Ok(())
}
