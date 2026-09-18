const validateGithubRepository = (req, res, next) => {
    const { owner, repo } = req.body;

    if (
        typeof owner !== "string" ||
        typeof repo !== "string"
    ) {
        return res.status(422).json({
            success: false,
            error: {
                code: "INVALID_GITHUB_REPOSITORY",
                message: "Owner and repository name are required"
            }
        });
    }

    if (
        owner.trim().length === 0 ||
        repo.trim().length === 0
    ) {
        return res.status(422).json({
            success: false,
            error: {
                code: "INVALID_GITHUB_REPOSITORY",
                message: "Owner and repository name cannot be empty"
            }
        });
    }

    next();
};

module.exports = {
    validateGithubRepository
};